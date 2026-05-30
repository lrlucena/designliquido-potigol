/// <reference types="node" />

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type ResultadoCaso = {
    caso: string;
    programa: string;
    passou: boolean;
    codigoSaida: number | null;
    sinal?: NodeJS.Signals | null;
    esperado?: string;
    recebido?: string;
    stderr?: string;
};

type ResultadoJson = {
    resumo: {
        diretorio: string;
        casos: number;
        aprovados: number;
        falhas: number;
    };
    resultados: ResultadoCaso[];
};

type LinhaResumo = {
    dataExecucao: string;
    versaoPotigol: string;
    diretorio: string;
    casos: number;
    aprovados: number;
    falhas: number;
    taxaAprovacao: number;
};

async function lerVersaoPotigol(): Promise<string> {
    const caminhoPackage = resolve(process.cwd(), 'package.json');
    const conteudo = await readFile(caminhoPackage, 'utf8');
    const pkg = JSON.parse(conteudo) as { version?: string };
    return pkg.version ?? 'desconhecida';
}

function escaparCsv(valor: unknown): string {
    const texto = String(valor ?? '').replace(/\r\n/g, '\\n').replace(/\n/g, '\\n');
    const comAspas = texto.replace(/"/g, '""');
    return `"${comAspas}"`;
}

function linhaCsv(colunas: unknown[]): string {
    return `${colunas.map((coluna) => escaparCsv(coluna)).join(',')}\n`;
}

function limitarTexto(valor: string | undefined, limite = 30): string {
    if (!valor) {
        return '';
    }

    return valor.length > limite ? valor.slice(0, limite) : valor;
}

function gerarCsvResumo(linha: LinhaResumo): string {
    let conteudo = '';
    conteudo += linhaCsv(['data_execucao', 'versao_potigol', 'diretorio', 'casos', 'aprovados', 'falhas', 'taxa_aprovacao']);
    conteudo += linhaCsv([
        linha.dataExecucao,
        linha.versaoPotigol,
        linha.diretorio,
        linha.casos,
        linha.aprovados,
        linha.falhas,
        linha.taxaAprovacao,
    ]);
    return conteudo;
}

function gerarCsvFalhas(linhaResumo: LinhaResumo, falhas: ResultadoCaso[]): string {
    let conteudo = '';
    conteudo += linhaCsv([
        'programa',
        'caso',
        'esperado',
        'recebido',
        'stderr',
    ]);

    for (const falha of falhas) {
        conteudo += linhaCsv([
            falha.programa,
            falha.caso,
            limitarTexto(falha.esperado),
            limitarTexto(falha.recebido),
            limitarTexto(falha.stderr, 100),
        ]);
    }

    return conteudo;
}

async function atualizarHistoricoCsv(caminhoHistorico: string, linha: LinhaResumo): Promise<void> {
    const cabecalho = linhaCsv(['data_execucao', 'versao_potigol', 'diretorio', 'casos', 'aprovados', 'falhas', 'taxa_aprovacao']);
    const registro = linhaCsv([
        linha.dataExecucao,
        linha.versaoPotigol,
        linha.diretorio,
        linha.casos,
        linha.aprovados,
        linha.falhas,
        linha.taxaAprovacao,
    ]);

    let conteudoAnterior = '';
    try {
        conteudoAnterior = await readFile(caminhoHistorico, 'utf8');
    } catch {
        conteudoAnterior = '';
    }

    const historicoVazio = conteudoAnterior.trim().length === 0;
    const cabecalhoCompativel = conteudoAnterior.startsWith(cabecalho);
    const precisaRecriarPorMudancaFormato = !historicoVazio && !cabecalhoCompativel;
    const base = historicoVazio || precisaRecriarPorMudancaFormato ? cabecalho : conteudoAnterior;
    const novoConteudo = `${base}${registro}`;
    await mkdir(dirname(caminhoHistorico), { recursive: true });
    await writeFile(caminhoHistorico, novoConteudo, 'utf8');
}

async function main() {
    const argumentos = process.argv.slice(2);
    const caminhoJson = resolve(
        process.cwd(),
        argumentos.find((arg) => !arg.startsWith('--')) ?? 'recursos/fontes/beecrowd/relatorios/resultado.json'
    );
    const argumentoSaida = argumentos.find((arg) => arg.startsWith('--saida-dir='));
    const argumentoHistorico = argumentos.find((arg) => arg.startsWith('--historico='));
    const saidaDir = resolve(
        process.cwd(),
        argumentoSaida?.split('=')[1] ?? 'recursos/fontes/beecrowd/relatorios'
    );
    const caminhoHistorico = resolve(
        process.cwd(),
        argumentoHistorico?.split('=')[1] ?? 'recursos/fontes/beecrowd/relatorios/historico-resumo.csv'
    );

    const versaoPotigol = await lerVersaoPotigol();
    const dataExecucao = new Date().toISOString();

    const conteudoJson = await readFile(caminhoJson, 'utf8');
    const resultado = JSON.parse(conteudoJson) as ResultadoJson;

    const taxaAprovacao = resultado.resumo.casos === 0
        ? 0
        : Number(((resultado.resumo.aprovados / resultado.resumo.casos) * 100).toFixed(2));

    const linhaResumo: LinhaResumo = {
        dataExecucao,
        versaoPotigol,
        diretorio: resultado.resumo.diretorio,
        casos: resultado.resumo.casos,
        aprovados: resultado.resumo.aprovados,
        falhas: resultado.resumo.falhas,
        taxaAprovacao,
    };

    const caminhoResumoCsv = resolve(saidaDir, 'resultado-resumo.csv');
    const caminhoFalhasCsv = resolve(saidaDir, 'resultado-falhas.csv');
    const csvResumo = gerarCsvResumo(linhaResumo);
    const csvFalhas = gerarCsvFalhas(linhaResumo, resultado.resultados);

    await mkdir(saidaDir, { recursive: true });
    await writeFile(caminhoResumoCsv, csvResumo, 'utf8');
    await writeFile(caminhoFalhasCsv, csvFalhas, 'utf8');
    await atualizarHistoricoCsv(caminhoHistorico, linhaResumo);

    console.log(`CSV resumo: ${caminhoResumoCsv}`);
    console.log(`CSV falhas: ${caminhoFalhasCsv}`);
    console.log(`CSV historico: ${caminhoHistorico}`);
}

main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
});
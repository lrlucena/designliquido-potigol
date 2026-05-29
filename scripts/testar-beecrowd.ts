/// <reference types="node" />

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, basename, extname, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

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

function normalizarSaida(texto: string): string {
    return texto
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((linha) => linha.replace(/[ \t]+$/g, ''))
        .join('\n')
        .trimEnd();
}

async function listarProgramas(diretorio: string): Promise<string[]> {
    const entradas = await readdir(diretorio, { withFileTypes: true });
    return entradas
        .filter((entrada) => entrada.isFile() && extname(entrada.name) === '.poti')
        .map((entrada) => join(diretorio, entrada.name))
        .sort();
}

async function listarEntradas(exemplosDir: string, problema: string): Promise<string[]> {
    const entradas = await readdir(exemplosDir, { withFileTypes: true });
    return entradas
        .filter((entrada) => entrada.isFile() && entrada.name.startsWith(`${problema}-`) && entrada.name.endsWith('.in'))
        .map((entrada) => join(exemplosDir, entrada.name))
        .sort();
}

async function executarCaso(programa: string, arquivoEntrada: string, arquivoSaidaEsperada: string): Promise<ResultadoCaso> {
    const entrada = await readFile(arquivoEntrada, 'utf8');
    const esperado = await readFile(arquivoSaidaEsperada, 'utf8');

    const execucao = spawnSync(
        'yarn',
        ['-s', 'executar-potigol:silencioso', programa],
        {
            cwd: process.cwd(),
            env: { ...process.env, NODE_NO_WARNINGS: '1' },
            input: entrada,
            encoding: 'utf8',
            timeout: 10000,
        }
    );

    const recebidoNormalizado = normalizarSaida(execucao.stdout ?? '');
    const esperadoNormalizado = normalizarSaida(esperado);
    const passou = execucao.status === 0 && recebidoNormalizado === esperadoNormalizado;

    return {
        caso: basename(arquivoEntrada),
        programa: basename(programa),
        passou,
        codigoSaida: execucao.status,
        sinal: execucao.signal,
        esperado: passou ? undefined : esperadoNormalizado,
        recebido: passou ? undefined : recebidoNormalizado,
        stderr: passou ? undefined : normalizarSaida(execucao.stderr ?? ''),
    };
}

async function main() {
    const argumentos = process.argv.slice(2);
    const argumentoLimite = argumentos.find((argumento) => argumento.startsWith('--limite='));
    const argumentoJson = argumentos.find((argumento) => argumento === '--json' || argumento.startsWith('--json='));
    const limite = argumentoLimite ? Number(argumentoLimite.split('=')[1]) : undefined;
    const caminhoJson = argumentoJson
        ? resolve(
            process.cwd(),
            argumentoJson.includes('=')
                ? argumentoJson.split('=')[1]
                : 'recursos/fontes/beecrowd/relatorios/resultado.json'
        )
        : undefined;
    const diretorioAlvo = resolve(
        process.cwd(),
        argumentos.find((argumento) => !argumento.startsWith('--')) ?? 'recursos/fontes/beecrowd/src/1000'
    );

    const info = await stat(diretorioAlvo);
    if (!info.isDirectory()) {
        console.error(`Diretorio invalido: ${diretorioAlvo}`);
        process.exitCode = 1;
        return;
    }

    const exemplosDir = join(diretorioAlvo, 'exemplos');
    const programas = await listarProgramas(diretorioAlvo);
    const resultados: ResultadoCaso[] = [];
    let casosExecutados = 0;
    let aprovadosAteAgora = 0;
    let falhasAteAgora = 0;

    for (const programa of programas) {
        const problema = basename(programa, '.poti');
        const entradas = await listarEntradas(exemplosDir, problema);

        for (const arquivoEntrada of entradas) {
            const arquivoSaidaEsperada = arquivoEntrada.replace(/\.in$/, '.out');
            const resultado = await executarCaso(programa, arquivoEntrada, arquivoSaidaEsperada);
            resultados.push(resultado);
            casosExecutados += 1;
            if (resultado.passou) {
                aprovadosAteAgora += 1;
            } else {
                falhasAteAgora += 1;
            }

            console.log(
                `[${casosExecutados}] Problema ${resultado.programa} | Caso ${resultado.caso} | OK: ${aprovadosAteAgora} | Falhas: ${falhasAteAgora}`
            );

            if (casosExecutados % 25 === 0) {
                console.log(`Resumo parcial: ${casosExecutados} casos executados | OK: ${aprovadosAteAgora} | Falhas: ${falhasAteAgora}`);
            }

            if (limite && casosExecutados >= limite) {
                break;
            }
        }

        if (limite && casosExecutados >= limite) {
            break;
        }
    }

    const total = resultados.length;
    const aprovados = resultados.filter((resultado) => resultado.passou);
    const falhas = resultados.filter((resultado) => !resultado.passou);
    const resumo = {
        diretorio: diretorioAlvo,
        casos: total,
        aprovados: aprovados.length,
        falhas: falhas.length,
    };

    console.log(`Diretorio: ${resumo.diretorio}`);
    console.log(`Casos: ${resumo.casos}`);
    console.log(`Aprovados: ${resumo.aprovados}`);
    console.log(`Falhas: ${resumo.falhas}`);

    if (caminhoJson) {
        const payload = {
            resumo,
            resultados: falhas,
        };

        await mkdir(dirname(caminhoJson), { recursive: true });
        await writeFile(caminhoJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        console.log(`Relatorio JSON: ${caminhoJson}`);
    }

    if (falhas.length > 0) {
        console.log('');
        console.log('Primeiras falhas:');
        for (const falha of falhas.slice(0, 20)) {
            console.log(`- ${falha.programa} / ${falha.caso}`);
            console.log(`  codigo de saida: ${falha.codigoSaida}`);
            if (falha.sinal) {
                console.log(`  sinal: ${falha.sinal}`);
            }
            if (falha.stderr) {
                console.log(`  stderr: ${falha.stderr}`);
            }
            console.log(`  esperado: ${JSON.stringify(falha.esperado ?? '')}`);
            console.log(`  recebido: ${JSON.stringify(falha.recebido ?? '')}`);
        }
        process.exitCode = 1;
    }
}

main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
});
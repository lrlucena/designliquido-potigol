import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

declare const process: any;

import { AvaliadorSintaticoPotigol } from '../fontes/avaliador-sintatico';
import { InterpretadorPotigol } from '../fontes/interpretador';
import { LexadorPotigol } from '../fontes/lexador';

async function main() {
    const caminhoEntrada = process.argv[2];

    if (!caminhoEntrada) {
        console.error('Uso: yarn executar-potigol <arquivo.poti>');
        process.exitCode = 1;
        return;
    }

    const caminhoAbsoluto = resolve(process.cwd(), caminhoEntrada);
    const conteudo = await readFile(caminhoAbsoluto, 'utf8');
    const linhas = conteudo.split(/\r?\n/);

    const lexador = new LexadorPotigol();
    const avaliadorSintatico = new AvaliadorSintaticoPotigol();
    const interpretador = new InterpretadorPotigol(process.cwd());
    let interfaceEntradaSaida: { question: (mensagem: string, callback: (resposta: string) => void) => void; close: () => void };

    if (process.stdin.isTTY) {
        const leitor = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        interfaceEntradaSaida = {
            question: (_mensagem: string, callback: (resposta: string) => void) => {
                leitor.question('', callback);
            },
            close: () => leitor.close(),
        };
    } else {
        // Em modo com redirecionamento (`< entrada.txt`), consumimos tudo uma vez
        // e entregamos linha por linha para evitar perda de buffer entre chamadas de leitura.
        const entradaCompleta = readFileSync(0, 'utf8');
        const linhasEntrada = entradaCompleta.replace(/\r\n/g, '\n').split('\n');
        let indiceLinha = 0;

        interfaceEntradaSaida = {
            question: (_mensagem: string, callback: (resposta: string) => void) => {
                const resposta = indiceLinha < linhasEntrada.length ? linhasEntrada[indiceLinha++] : '';
                queueMicrotask(() => callback(resposta));
            },
            close: () => {
                // Sem recursos a fechar no modo bufferizado.
            },
        };
    }

    interpretador.interfaceEntradaSaida = interfaceEntradaSaida as any;

    interpretador.funcaoDeRetorno = (saida: unknown) => {
        console.log(String(saida));
    };

    try {
        const retornoLexador = lexador.mapear(linhas, -1);
        const retornoAvaliadorSintatico = await avaliadorSintatico.analisar(retornoLexador, -1);

        if (retornoAvaliadorSintatico.erros.length > 0) {
            console.error(retornoAvaliadorSintatico.erros);
            process.exitCode = 1;
            return;
        }

        const retornoInterpretador = await interpretador.interpretar(retornoAvaliadorSintatico.declaracoes);

        if (retornoInterpretador.erros.length > 0) {
            console.error(retornoInterpretador.erros);
            process.exitCode = 1;
        }
    } finally {
        interfaceEntradaSaida.close();
    }
}

main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
});

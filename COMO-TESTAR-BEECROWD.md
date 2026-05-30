# Como usar o script testar-beecrowd

Este guia documenta o script `testar-beecrowd`, usado para validar programas Potigol contra casos de teste no formato BeeCrowd.

## 1. Pre-requisitos

- Dependencias instaladas na raiz do projeto:

```bash
yarn
```

- `git` instalado, para baixar os programas e exemplos do repositório externo.

## 2. Baixar os programas e exemplos do beecrowd

Na raiz do projeto, execute:

```bash
rm -rf /tmp/potigol-beecrowd
git clone --depth 1 https://github.com/potigol/beecrowd /tmp/potigol-beecrowd
mkdir -p recursos/fontes/beecrowd
rsync -a --delete /tmp/potigol-beecrowd/src/ recursos/fontes/beecrowd/src/
```

Isso copia para o repositório local:

- os programas `.poti`;
- as pastas `exemplos` com arquivos `.in` e `.out`;
- a mesma estrutura original por faixa de problemas (`1000`, `2000`, etc.).

Ao final, a estrutura local fica assim:

```text
recursos/fontes/beecrowd/src/
  1000/
  1100/
  1200/
  ...
```

Se quiser atualizar os exemplos depois, basta repetir os mesmos comandos.

## 3. Comando basico

```bash
yarn testar-beecrowd
```

Sem argumentos, o script usa o diretorio padrao:

`recursos/fontes/beecrowd/src/1000`

## 4. Sintaxe completa

```bash
yarn testar-beecrowd [diretorio] [--limite=N] [--json] [--json=caminho/arquivo.json]
```

### Argumentos e opcoes

- `diretorio`: pasta que contem os programas `.poti` e a subpasta `exemplos`.
- `--limite=N`: limita o total de casos executados.
- `--json`: gera relatorio JSON no caminho padrao.
- `--json=caminho/arquivo.json`: gera relatorio JSON no caminho informado.

Quando `--json` e usado sem caminho, o arquivo padrao e:

`recursos/fontes/beecrowd/relatorios/resultado.json`

## 5. Estrutura esperada de arquivos

No diretorio informado, o script procura:

- arquivos de programa `*.poti`;
- uma pasta `exemplos`;
- para cada programa `XXXX.poti`, arquivos de entrada/saida:
  - `exemplos/XXXX-*.in`
  - `exemplos/XXXX-*.out`

Exemplo:

```text
recursos/fontes/beecrowd/src/1000/
  1001.poti
  1002.poti
  exemplos/
    1001-1.in
    1001-1.out
    1002-1.in
    1002-1.out
```

## 6. Exemplos de uso

Executar tudo no diretorio padrao:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd
```

Executar somente 5 casos:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd --limite=5
```

Executar em outro conjunto de problemas:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd recursos/fontes/beecrowd/src/2000
```

Gerar relatorio JSON no caminho padrao:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd --json
```

Gerar relatorio JSON em caminho customizado:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd --json=recursos/fontes/beecrowd/relatorios/rodada-1000.json
```

Combinar opcoes:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd recursos/fontes/beecrowd/src/1000 --limite=20 --json
```

## 7. Gerar CSV para versionar no GitHub

Depois de gerar o JSON, converta para CSV:

```bash
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd:csv
```

Esse comando le, por padrao, `recursos/fontes/beecrowd/relatorios/resultado.json`
e gera:

- `recursos/fontes/beecrowd/relatorios/resultado-resumo.csv`
- `recursos/fontes/beecrowd/relatorios/resultado-falhas.csv`
- `recursos/fontes/beecrowd/relatorios/historico-resumo.csv`

O arquivo `historico-resumo.csv` recebe uma nova linha por execucao, com data,
versao, totais e taxa de aprovacao, permitindo acompanhar a evolucao entre execucoes.

No `resultado-falhas.csv`, os campos de texto sao truncados para facilitar diff no GitHub:

- `esperado`: 30 caracteres
- `recebido`: 30 caracteres
- `stderr`: 100 caracteres

Opcoes uteis:

```bash
# JSON de entrada customizado
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd:csv recursos/fontes/beecrowd/relatorios/resultado_1100.json

# diretorio de saida customizado
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd:csv --saida-dir=recursos/fontes/beecrowd/relatorios/csv

# caminho customizado para o historico
NODE_NO_WARNINGS=1 yarn -s testar-beecrowd:csv --historico=recursos/fontes/beecrowd/relatorios/csv/historico.csv
```

## 8. Saida e codigos de retorno

Ao final, o script mostra:

- diretorio testado;
- total de casos;
- quantidade de aprovados;
- quantidade de falhas.

Se houver falhas, tambem imprime as primeiras falhas com:

- programa e caso;
- codigo de saida;
- sinal de processo (quando existir);
- stderr;
- saida esperada e recebida.

Codigo de retorno do processo:

- `0`: todos os casos passaram;
- `1`: houve falha em pelo menos um caso, erro de diretorio invalido, ou erro de execucao.

## 9. Observacoes

- Cada caso tem timeout de 10 segundos.
- O progresso e exibido a cada 25 casos executados.
- O relatorio JSON inclui um bloco `resumo` e uma lista `resultados` com cada caso executado.

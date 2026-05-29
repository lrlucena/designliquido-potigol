# Como executar um programa em Potigol

Este guia mostra o passo a passo para executar um arquivo Potigol (`.poti`) neste repositório.

## 1. Pre-requisitos

- Node.js instalado (recomendado: versao LTS).
- Yarn instalado.

## 2. Instalar dependencias

Na raiz do projeto, execute:

```bash
yarn
```

## 3. Executar um arquivo Potigol

Use o script do projeto informando o caminho do arquivo `.poti`:

```bash
yarn executar-potigol <caminho/arquivo.poti>
```

Exemplo com o arquivo de teste da raiz:

```bash
NODE_NO_WARNINGS=1 yarn -s executar-potigol olamundo.poti
```

## 4. Executar com entrada padrao (stdin)

Se o programa usa leitura de dados, voce pode redirecionar um arquivo de entrada:

```bash
NODE_NO_WARNINGS=1 yarn -s executar-potigol <caminho/arquivo.poti> < entrada.txt
```

Exemplo:

```bash
NODE_NO_WARNINGS=1 yarn -s executar-potigol olamundo.poti < entrada.txt
```

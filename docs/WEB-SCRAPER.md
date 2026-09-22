# VUA Web Scraper

Adapter governado para receber uma URL HTTP(S) pública e devolver JSON estruturado.

## Uso

```bash
npm run vua invoke web-scraper scrape_url '{"url":"https://example.com"}'
```

O resultado passa pelo pipeline VUA e inclui ExecutionProof/verification.

## Campos

- URL final e timestamp de coleta
- HTTP status e content-type
- título, descrição, idioma, canonical, autor e data publicada quando presentes
- headings
- texto normalizado
- links resolvidos
- e-mails e telefones encontrados no texto
- JSON-LD válido
- proveniência `WEB / VUA_WEB_SCRAPER / OBSERVED`

## Segurança

- somente HTTP/HTTPS
- bloqueio explícito de localhost e endpoints de metadata conhecidos
- timeout configurável entre 1s e 30s
- limite de resposta entre 10 KB e 5 MB
- sem credenciais automáticas
- ação somente de leitura; não publica nem altera o site alvo

## Limitação

A versão 1 processa HTML/JSON retornado pelo servidor. Páginas que dependem de JavaScript para montar o conteúdo exigirão uma futura camada Playwright/browser.

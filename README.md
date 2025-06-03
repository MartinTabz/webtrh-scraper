## WebTrh Scraper

Tato jednoduchá NextJS aplikace má za úkol hlídat nově přidané poptávky na WebTrh, a pokud je poptávka relevantní, tak se pošle upozornění na mobil do aplikace Pushover.

### Technologie

- Vercel CRON jobs - každé 2 minuty odešlě dotaz na API route (s klíčem)
- Axios - získá HTML stránky s poptávkami
- Cheerio - zpracuje HTML a získá hodnotu nejnovější poptávky 
- Redis KV - pro ukládání poslední poptávky, která se poté porovnává
- OpenAI API - pokud byla přidána nová poptávka (poslední uložení v Redis KV se nerovná aktuální nalezené), tak se název pošle gpt 4o mini modelu, který vrátí "true" nebo "false" na základě promptu, který určuje jaké zakázky jsou relevantní
- Pushover - pokud je nová poptávka relevantní tak se pomocí Axiosu pošle API request pro odeslání upozornění do emailu

# Pipe Dreams

A Hardisty egress netback monitor: where should a WCS barrel at Hardisty go this month, and what is it worth?

Live site: https://syedline.github.io/pipe-dreams/

## Data

`public/data.json` is refreshed every 3 days by the **Refresh data** GitHub Action (EIA, Bank of Canada, CrudeMonitor, CER).

The WTI–WCS differential comes from the Government of Alberta's economic data API, which blocks GitHub's servers. Refresh it locally about once a month:

```sh
npm run refresh        # needs EIA_API_KEY in .env.local
git add public/data.json && git commit -m "Refresh WCS differential" && git push
```

Tolls and assumptions in `data.json` are maintained by hand; tolls are flagged stale when their effective date is more than 6 months old.

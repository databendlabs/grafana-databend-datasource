# Grafana Databend Data Source Plugin

The Databend data source plugin for Grafana allows you to visualize data from Databend in Grafana.

This plugin supports both `Databend` and `Databend Cloud`.

## Building

### Frontend

```bash
$ yarn install
$ yarn build
```

### Backend

```bash
$ mage -v
```

### Example server

```bash
$ mage server
$ ./cmd/server/server :10000
2022/10/28 15:43:16 listening on :10000
```

Then, add a new data source in Grafana and use the following url:

```
http://127.0.0.1:10000/metrics
```


### Docker

Test your plugin using docker compose:

```bash
$ docker compose up -d
```

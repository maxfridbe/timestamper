# Timestamper
A simple analyzer for logs

- You add a "trace" which is a search through logs
- Trace returns and graphs into bins
- Bins allow you to see timing of logs occurances and corelate to other traces.

- Sqlite DB expected to be of the form

```
CREATE TABLE Logs (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    PartitionKey TEXT NOT NULL,
                    MachineName TEXT NOT NULL,
                    Timestamp INTEGER NOT NULL,
                    Message TEXT NOT NULL,
                    CallingClass TEXT NOT NULL,
                    LogCode TEXT NOT NULL,
                    ThreadId INTEGER NOT NULL
                )
```
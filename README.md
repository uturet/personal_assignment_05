# Events Service API

This project exposes an Express-based REST API for managing users and events.
It persists data in MongoDB and enforces the following collections.

```txt
users
    id              ObjectId
    first_name      string (required)
    last_name       string (required)
    email           string (required, unique)
    password        string (hash stored as salt:hash using scrypt)
    subscribet_to   ObjectId[] (optional list of user ids)

events
    id              ObjectId
    visibility      enum('public', 'subscribers', 'private')
    google_point    string (maps location reference)
    description     string
    datetime_start  Date
    datetime_end    Date (must be after datetime_start)
    period          Date (represents the repeat cadence anchor)
    repeat_until    Date (must be on/after datetime_start)
```

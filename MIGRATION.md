# Migrating to Supabase (PostgreSQL)

This project has been refactored from SQLite to PostgreSQL via Supabase.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project** and fill in a name, password, and region.
3. Wait for the project to finish provisioning (~2 minutes).

---

## 2. Get Your Connection String

1. In your Supabase project, go to **Settings ? Database**.
2. Under **Connection string**, select the **URI** tab and copy the string.
   It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
3. Alternatively use the **Parameters** tab to get individual values:
   - **Host**: `db.xxxxxxxxxxxx.supabase.co`
   - **Port**: `5432`
   - **Database**: `postgres`
   - **Username**: `postgres`
   - **Password**: the password you set when creating the project

---

## 3. Configure the Connection String

Update `appsettings.json` (or use User Secrets / environment variables in production):

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=db.xxxxxxxxxxxx.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=YOUR_PASSWORD;SSL Mode=Require;Trust Server Certificate=true"
}
```

> **Never commit real credentials to source control.**
> Use `dotnet user-secrets` for local development:
> ```powershell
> cd MarchMadness.Web
> dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Password=..."
> ```

---

## 4. Apply the Migration

The old SQLite migrations have been deleted and a fresh PostgreSQL migration has been generated.

Run it with the EF Core CLI:

```powershell
cd MarchMadness.Web
dotnet ef database update
```

This will create all tables (`Teams`, `Users`, `Games`, `Brackets`, `Picks`) and their indexes in your Supabase database.

---

## 5. Run the Application

```powershell
cd MarchMadness.Web
dotnet run
```

On startup the app calls `db.Database.Migrate()`, which will apply any pending migrations automatically.

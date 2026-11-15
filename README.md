# taskmanger

A daily task planner with a Django session-authenticated API, a React/Tailwind
frontend, and MySQL persistence.

## Backend

1. Create a MySQL database named `taskmanger` (for example,
   `CREATE DATABASE taskmanger CHARACTER SET utf8mb4;`).
2. From this directory, install Python dependencies:

   ```sh
   python -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Configure the database:

   ```sh
   cp .env.example .env
   ```

   Edit `.env` and set `MYSQL_PASSWORD` to your MySQL root password. The other
   defaults are `127.0.0.1:3306`, database `taskmanger`, and user `root`. The
   `.env` file is ignored by Git and should not be shared. Set a unique
   `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, and `DJANGO_ALLOWED_HOSTS` for
   production.
4. Build the React app once so Django can serve it at `/`:

   ```sh
   cd frontend
   npm install
   npm run build
   cd ..
   ```

5. In **Terminal 1**, apply migrations and start Django:

   ```sh
   python manage.py migrate
   python manage.py runserver 127.0.0.1:8000
   ```

## Frontend

In **Terminal 2** (leave Django running in Terminal 1), run Vite for live
frontend development:

```sh
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:8000/` to see the built React app served by Django, or
`http://127.0.0.1:5173/` for the separate Vite dev server. Vite proxies `/api`
requests to Django at `http://127.0.0.1:8000`. The Django admin remains at
`http://127.0.0.1:8000/admin/` unchanged.

To run only the backend, use Terminal 1 without starting Vite. To run only the
frontend, start Vite without Django; the page loads, but API-backed features
will be unavailable until the backend is running.

## Testing the API with Postman

Use `http://127.0.0.1:8000` as the base URL:

1. Send `GET /api/auth/csrf/`. Keep cookies enabled in Postman and copy
   `csrfToken` from the JSON response.
2. Send `POST /api/auth/register/` or `POST /api/auth/login/` with
   `Content-Type: application/json`, `X-CSRFToken: <csrfToken>`, and a JSON
   body such as `{"email":"you@example.com","password":"your-password"}`.
   Postman should retain the session cookie from the response.
3. After login or registration, send `GET /api/auth/csrf/` again to get the
   rotated CSRF token. Use it in `X-CSRFToken` for `POST`, `PATCH`, and `DELETE`
   requests. Reuse the session cookie for authenticated task endpoints.
4. `GET /api/tasks/?date=YYYY-MM-DD` lists your tasks for a day. `POST
   /api/tasks/` creates a task; `PATCH /api/tasks/<id>/` updates it; and
   `DELETE /api/tasks/<id>/` removes it.

## Tests

The test settings use an in-memory SQLite database, so the API tests do not
require a running MySQL server:

```sh
DJANGO_SETTINGS_MODULE=taskmanger.test_settings python manage.py test tasks
```

## Features

- Email and password account registration and login.
- Add tasks with optional notes to any selected day.
- Mark tasks complete, remove them, and see daily completion progress.
- Tasks are private to the signed-in user.

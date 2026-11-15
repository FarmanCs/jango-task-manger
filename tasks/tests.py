import json

from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import Task, User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class TaskApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('planner@example.com', 'A-strong-password!42')
        self.client.force_login(self.user)

    def test_root_serves_frontend_and_preserves_admin_and_api_routes(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="root"')
        self.assertEqual(self.client.get(reverse('admin:login')).status_code, 200)
        api_status = self.client.get(reverse('api-root'))
        self.assertEqual(api_status.json()['status'], 'running')

    def test_registers_and_logs_in_with_email(self):
        self.client.logout()
        response = self.client.post(
            reverse('register'),
            data=json.dumps({
                'email': 'new.planner@example.com',
                'password': 'Another-strong-password!42',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['user']['email'], 'new.planner@example.com')

        self.client.logout()
        response = self.client.post(
            reverse('login'),
            data=json.dumps({
                'email': 'new.planner@example.com',
                'password': 'Another-strong-password!42',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

    def test_registration_accepts_the_local_frontend_origin_with_csrf(self):
        client = Client(enforce_csrf_checks=True)
        csrf_response = client.get(reverse('csrf-token'))
        response = client.post(
            reverse('register'),
            data=json.dumps({
                'email': 'frontend.planner@example.com',
                'password': 'Another-strong-password!42',
            }),
            content_type='application/json',
            HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_X_CSRFTOKEN=csrf_response.json()['csrfToken'],
        )
        self.assertEqual(response.status_code, 201)

    def test_authenticated_task_creation_works_after_page_reload(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        csrf_response = client.get(reverse('csrf-token'))

        response = client.post(
            reverse('task-collection'),
            data=json.dumps({
                'title': 'Task after refresh',
                'planned_date': '2026-11-15',
            }),
            content_type='application/json',
            HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_X_CSRFTOKEN=csrf_response.json()['csrfToken'],
        )
        self.assertEqual(response.status_code, 201)

    def test_creates_lists_and_updates_a_planned_task(self):
        response = self.client.post(
            reverse('task-collection'),
            data=json.dumps({'title': 'Read a chapter', 'planned_date': '2026-11-15'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        task_id = response.json()['task']['id']

        listed = self.client.get(reverse('task-collection'), {'date': '2026-11-15'})
        self.assertEqual(len(listed.json()['tasks']), 1)

        updated = self.client.patch(
            reverse('task-detail', args=[task_id]),
            data=json.dumps({'is_completed': True}),
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(updated.json()['task']['is_completed'])

    def test_user_cannot_update_another_users_task(self):
        other_user = User.objects.create_user('other@example.com', 'A-strong-password!42')
        task = Task.objects.create(
            user=other_user,
            title='Private task',
            planned_date='2026-11-15',
        )

        response = self.client.patch(
            reverse('task-detail', args=[task.id]),
            data=json.dumps({'is_completed': True}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_rejects_malformed_task_dates(self):
        response = self.client.post(
            reverse('task-collection'),
            data=json.dumps({'title': 'No date', 'planned_date': 'not-a-date'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

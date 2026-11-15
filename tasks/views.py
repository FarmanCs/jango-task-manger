import json
from datetime import date

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods

from .models import Task, User


def api_root(request):
    return JsonResponse({
        'name': 'taskmanger API',
        'status': 'running',
        'endpoints': {
            'csrf': 'GET /api/auth/csrf/',
            'register': 'POST /api/auth/register/',
            'login': 'POST /api/auth/login/',
            'logout': 'POST /api/auth/logout/',
            'current_user': 'GET /api/auth/me/',
            'tasks': 'GET, POST /api/tasks/',
            'task': 'PATCH, DELETE /api/tasks/<id>/',
            'admin': '/admin/',
        },
    })


def _json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _error(message, status):
    return JsonResponse({'error': message}, status=status)


def _user_payload(user):
    return {'id': user.id, 'email': user.email}


def _task_payload(task):
    return {
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'planned_date': task.planned_date.isoformat(),
        'is_completed': task.is_completed,
        'created_at': task.created_at.isoformat(),
    }


def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


@require_http_methods(['POST'])
def register(request):
    data = _json_body(request)
    if not isinstance(data, dict):
        return _error('Invalid JSON body.', 400)
    email = data.get('email', '')
    password = data.get('password', '')
    if not isinstance(email, str) or not isinstance(password, str):
        return _error('Email and password must be strings.', 400)
    email = email.strip().lower()
    if not email or not password:
        return _error('Email and password are required.', 400)
    try:
        validate_email(email)
    except ValidationError:
        return _error('Enter a valid email address.', 400)
    if User.objects.filter(email__iexact=email).exists():
        return _error('An account with this email already exists.', 409)
    candidate = User(email=email)
    try:
        validate_password(password, candidate)
    except ValidationError as error:
        return _error(' '.join(error.messages), 400)
    user = User.objects.create_user(email=email, password=password)
    login(request, user)
    return JsonResponse({'user': _user_payload(user)}, status=201)


@require_http_methods(['POST'])
def login_view(request):
    data = _json_body(request)
    if not isinstance(data, dict):
        return _error('Invalid JSON body.', 400)
    email = data.get('email', '')
    password = data.get('password', '')
    if not isinstance(email, str) or not isinstance(password, str):
        return _error('Email and password must be strings.', 400)
    email = email.strip().lower()
    user = authenticate(request, email=email, password=password)
    if user is None:
        return _error('Email or password is incorrect.', 400)
    login(request, user)
    return JsonResponse({'user': _user_payload(user)})


@require_http_methods(['POST'])
def logout_view(request):
    logout(request)
    return JsonResponse({'ok': True})


@require_http_methods(['GET'])
def current_user(request):
    if not request.user.is_authenticated:
        return _error('Authentication required.', 401)
    return JsonResponse({'user': _user_payload(request.user)})


@require_http_methods(['GET', 'POST'])
def task_collection(request):
    if not request.user.is_authenticated:
        return _error('Authentication required.', 401)
    if request.method == 'GET':
        tasks = Task.objects.filter(user=request.user)
        requested_date = request.GET.get('date')
        if requested_date:
            try:
                date.fromisoformat(requested_date)
            except ValueError:
                return _error('Date must use YYYY-MM-DD format.', 400)
            tasks = tasks.filter(planned_date=requested_date)
        return JsonResponse({'tasks': [_task_payload(task) for task in tasks]})

    data = _json_body(request)
    if not isinstance(data, dict):
        return _error('Invalid JSON body.', 400)
    title = data.get('title', '')
    description = data.get('description', '')
    planned_date = data.get('planned_date')
    if not isinstance(title, str) or not isinstance(description, str):
        return _error('Task title and description must be strings.', 400)
    title = title.strip()
    if not title:
        return _error('A task title is required.', 400)
    if len(title) > 180:
        return _error('Task titles must be 180 characters or fewer.', 400)
    try:
        planned_date = date.fromisoformat(planned_date)
    except (TypeError, ValueError):
        return _error('A valid planned_date (YYYY-MM-DD) is required.', 400)
    task = Task.objects.create(
        user=request.user,
        title=title,
        description=description.strip(),
        planned_date=planned_date,
    )
    return JsonResponse({'task': _task_payload(task)}, status=201)


@require_http_methods(['PATCH', 'DELETE'])
def task_detail(request, task_id):
    if not request.user.is_authenticated:
        return _error('Authentication required.', 401)
    try:
        task = Task.objects.get(id=task_id, user=request.user)
    except Task.DoesNotExist:
        return _error('Task not found.', 404)
    if request.method == 'DELETE':
        task.delete()
        return JsonResponse({'ok': True})

    data = _json_body(request)
    if not isinstance(data, dict):
        return _error('Invalid JSON body.', 400)
    if 'title' in data:
        if not isinstance(data['title'], str):
            return _error('Task title must be a string.', 400)
        title = data['title'].strip()
        if not title or len(title) > 180:
            return _error('Task titles must contain 1 to 180 characters.', 400)
        task.title = title
    if 'description' in data:
        if not isinstance(data['description'], str):
            return _error('Task description must be a string.', 400)
        task.description = data['description'].strip()
    if 'planned_date' in data:
        try:
            task.planned_date = date.fromisoformat(data['planned_date'])
        except (TypeError, ValueError):
            return _error('A valid planned_date (YYYY-MM-DD) is required.', 400)
    if 'is_completed' in data:
        if not isinstance(data['is_completed'], bool):
            return _error('is_completed must be a boolean.', 400)
        task.is_completed = data['is_completed']
    task.save()
    return JsonResponse({'task': _task_payload(task)})

from django.urls import path

from . import views

urlpatterns = [
    path('', views.api_root, name='api-root'),
    path('auth/csrf/', views.csrf_token, name='csrf-token'),
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.current_user, name='current-user'),
    path('tasks/', views.task_collection, name='task-collection'),
    path('tasks/<int:task_id>/', views.task_detail, name='task-detail'),
]

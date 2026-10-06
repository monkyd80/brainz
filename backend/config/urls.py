"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from companies import auth_views
from companies import password_recovery

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('companies.urls')),
    path('api/auth/signup/', auth_views.signup),
    path('api/auth/login/', auth_views.login),
    path('api/auth/password-reset/', password_recovery.request_reset),
    path('api/auth/password-reset/confirm/', password_recovery.confirm_reset),
    path('api/auth/change-password/', auth_views.change_own_password),
    path('api/auth/profile/', auth_views.own_profile),
    path('api/auth/site-user-groups/', auth_views.site_user_groups),
    path('api/auth/switch-user/', auth_views.switch_user),
    path('api/admin/users/', auth_views.admin_users),
    path('api/admin/users/<int:user_id>/', auth_views.admin_user_detail),
    path('api/admin/users/<int:user_id>/password/', auth_views.admin_change_password),
    path('api/admin/assignments/', auth_views.admin_assignments),
]

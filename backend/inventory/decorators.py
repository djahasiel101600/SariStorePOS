# inventory/decorators.py
from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.decorators import login_required

def role_required(allowed_roles):
    """
    Decorator for role-based access control.
    Works with both regular Django views and DRF API views.
    """
    def decorator(view_func):
        @wraps(view_func)
        @login_required
        def _wrapped_view(request, *args, **kwargs):
            # Check if user has profile
            if not hasattr(request.user, 'profile'):
                return Response(
                    {'error': 'User profile not found'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            user_role = request.user.profile.role
            
            # Check if user has required role
            if user_role in allowed_roles:
                return view_func(request, *args, **kwargs)
            
            # Permission denied
            return Response(
                {
                    'error': f'Insufficient permissions. Required roles: {allowed_roles}',
                    'your_role': user_role
                }, 
                status=status.HTTP_403_FORBIDDEN
            )
        return _wrapped_view
    return decorator

# Alternative version specifically for DRF API views
def drf_role_required(allowed_roles):
    """
    DRF-specific role decorator that works with @api_view
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # Check authentication
            if not request.user.is_authenticated:
                return Response(
                    {'error': 'Authentication required'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Check if user has profile
            if not hasattr(request.user, 'profile'):
                return Response(
                    {'error': 'User profile not found'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            user_role = request.user.profile.role
            
            # Check if user has required role
            if user_role in allowed_roles:
                return view_func(request, *args, **kwargs)
            
            # Permission denied
            return Response(
                {
                    'error': f'Insufficient permissions. Required roles: {allowed_roles}',
                    'your_role': user_role
                }, 
                status=status.HTTP_403_FORBIDDEN
            )
        return _wrapped_view
    return decorator
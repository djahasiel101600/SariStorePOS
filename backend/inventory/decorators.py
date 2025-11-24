# inventory/decorators.py
from functools import wraps
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

def role_required(allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        @login_required
        def _wrapped_view(request, *args, **kwargs):
            if not hasattr(request.user, 'profile'):
                return JsonResponse({'error': 'User profile not found'}, status=403)
            
            user_role = request.user.profile.role
            if user_role in allowed_roles:
                return view_func(request, *args, **kwargs)
            
            return JsonResponse({
                'error': f'Insufficient permissions. Required: {allowed_roles}'
            }, status=403)
        return _wrapped_view
    return decorator
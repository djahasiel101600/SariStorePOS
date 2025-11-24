# permissions.py
from rest_framework import permissions


class RoleRequiredPermission(permissions.BasePermission):
    """
    Permission class that supports either being instantiated with an
    explicit `allowed_roles` list or used as a class that reads
    allowed roles from the `view` (attribute `allowed_roles` or
    method `get_allowed_roles`). This makes it robust when DRF
    instantiates it or when callers provide an instance.
    """

    def __init__(self, allowed_roles=None):
        # allowed_roles may be provided at construction time or
        # determined at permission check time from the view.
        self.allowed_roles = allowed_roles

    def _resolve_allowed_roles(self, view):
        # Priority: instance allowed_roles > view.get_allowed_roles() > view.allowed_roles
        if self.allowed_roles:
            return self.allowed_roles
        if view is not None:
            get_allowed = getattr(view, 'get_allowed_roles', None)
            if callable(get_allowed):
                try:
                    roles = get_allowed()
                    if roles is not None:
                        return roles
                except TypeError:
                    # get_allowed_roles may expect (self, request) in some custom views; ignore
                    pass
            roles = getattr(view, 'allowed_roles', None)
            if roles is not None:
                return roles
        return []

    def has_permission(self, request, view):
        allowed = self._resolve_allowed_roles(view)
        try:
            return (
                bool(request.user) and
                request.user.is_authenticated and
                hasattr(request.user, 'profile') and
                request.user.profile.role in allowed
            )
        except Exception:
            return False

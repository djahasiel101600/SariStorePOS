# backend/inventory/jwt_auth_middleware.py
import logging
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from inventory.models import User
from urllib.parse import parse_qs

logger = logging.getLogger(__name__)


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    Token can be passed as:
    - Query parameter: ws://localhost:8000/ws/realtime/?token=<jwt_token>
    - Cookie: jwt_token=<jwt_token>
    """

    async def __call__(self, scope, receive, send):
        # Get token from query string or cookies
        token = None
        
        # Try query string first
        query_string = scope.get('query_string', b'').decode()
        if query_string:
            query_params = parse_qs(query_string)
            token = query_params.get('token', [None])[0]
            logger.info(f"Token from query string: {token[:20] if token else 'None'}...")
        
        # Try cookies if no query token
        if not token:
            headers = dict(scope.get('headers', []))
            cookie_header = headers.get(b'cookie', b'').decode()
            if cookie_header:
                cookies = dict(item.split('=', 1) for item in cookie_header.split('; ') if '=' in item)
                token = cookies.get('jwt_token')
                logger.info(f"Token from cookie: {token[:20] if token else 'None'}...")
        
        if not token:
            logger.warning("No token provided in WebSocket connection")
        
        # Authenticate user
        scope['user'] = await self.get_user_from_token(token)
        logger.info(f"WebSocket user authenticated: {scope['user']}")
        
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token):
        """
        Validate JWT token and return user
        """
        if not token:
            logger.warning("No token provided")
            return AnonymousUser()
        
        try:
            # Validate token
            access_token = AccessToken(token)
            user_id = access_token.get('user_id')
            logger.info(f"Token validated, user_id: {user_id}")
            
            # Get user
            user = User.objects.get(id=user_id)
            logger.info(f"User found: {user.username}")
            return user
        except TokenError as e:
            logger.error(f"Token validation error: {e}")
            return AnonymousUser()
        except User.DoesNotExist:
            logger.error(f"User with id {user_id} not found")
            return AnonymousUser()
        except KeyError as e:
            logger.error(f"Missing key in token: {e}")
            return AnonymousUser()
        except Exception as e:
            logger.error(f"Unexpected error in JWT auth: {e}")
            return AnonymousUser()

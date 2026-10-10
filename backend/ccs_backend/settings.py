from pathlib import Path
import os
from datetime import timedelta
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except Exception:
    pass

# ==============================================================================
# CORE SECURITY & ENVIRONMENT CONFIGURATION
# ==============================================================================

# DEBUG: Defaults to False in production, explicitly True only when DJANGO_DEBUG=1
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'

# SECRET_KEY: Must be provided via environment variable in production
_default_dev_key = 'django-insecure-ccs-connect-dev-signing-key-minimum-64-characters-long-2026-prod-audit'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = _default_dev_key
    else:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY environment variable is required in production.")

# ALLOWED_HOSTS: Configured via DJANGO_ALLOWED_HOSTS (comma-separated)
_allowed_hosts_env = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
if _allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'chitracropsciencepartners.com', 'www.chitracropsciencepartners.com']

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'channels',
    'apps.common',
    'apps.accounts',
    'apps.crm',
    'apps.orders',
    'apps.hr',
    'apps.products',
    'apps.reports',
    'apps.notifications',
    'apps.support',
    'apps.wallet',
    'apps.inventory',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ccs_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ccs_backend.wsgi.application'
ASGI_APPLICATION = 'ccs_backend.asgi.application'

# ==============================================================================
# REDIS & DJANGO CHANNELS CONFIGURATION
# ==============================================================================

REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0')
USE_REDIS = os.environ.get('USE_REDIS', '1') == '1'

if USE_REDIS and REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

# ==============================================================================
# DATABASE CONFIGURATION (POSTGRESQL SOURCE OF TRUTH)
# ==============================================================================

import dj_database_url

if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=0,
            conn_health_checks=True,
        )
    }
elif os.environ.get('DB_ENGINE', 'sqlite').lower() == 'postgres':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'ccs'),
            'USER': os.environ.get('POSTGRES_USER', 'ccs'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3'
        }
    }

# ==============================================================================
# AUTHENTICATION & PASSWORDS
# ==============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'accounts.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Calcutta'
USE_I18N = True
USE_TZ = True

# ==============================================================================
# STATIC & MEDIA FILES
# ==============================================================================

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==============================================================================
# REST FRAMEWORK & JWT CONFIGURATION
# ==============================================================================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'EXCEPTION_HANDLER': 'apps.common.exceptions.production_exception_handler',
}

# Ensure JWT key satisfies minimum length requirement (>= 32 bytes)
_jwt_key = os.environ.get('JWT_SIGNING_KEY', SECRET_KEY)
if len(_jwt_key) < 32:
    _jwt_key = _jwt_key.ljust(32, '0')

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'SIGNING_KEY': _jwt_key,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'AUTH_COOKIE': 'refresh_token',
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SECURE': not DEBUG,
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

# ==============================================================================
# CORS & CSRF TRUSTED ORIGINS
# ==============================================================================

CORS_ALLOW_CREDENTIALS = True
# Only allow all origins in local debug mode if explicitly requested
CORS_ALLOW_ALL_ORIGINS = DEBUG and (os.environ.get('CORS_ALLOW_ALL_ORIGINS', '1') == '1')

_env_cors = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
CORS_ALLOWED_ORIGINS = [
    'https://chitracropsciencepartners.com',
    'https://www.chitracropsciencepartners.com',
    'https://ccssoftware-dbb3.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
] + _env_cors

from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    'bypass-tunnel-reminder',
    'ngrok-skip-browser-warning',
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
    r"^https:\/\/.*\.vercel\.app$",
    r"^http:\/\/192\.168\.\d+\.\d+(:\d+)?$",
    r"^http:\/\/10\.0\.2\.2(:\d+)?$",
    r"^capacitor:\/\/localhost$",
    r"^https:\/\/localhost$",
    r"^http:\/\/localhost$",
]

_env_csrf = [o.strip() for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]
CSRF_TRUSTED_ORIGINS = [
    'https://chitracropsciencepartners.com',
    'https://www.chitracropsciencepartners.com',
    'https://ccssoftware-dbb3.vercel.app',
    'https://*.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
] + _env_csrf

# ==============================================================================
# HTTPS, COOKIES & SECURITY HEADERS
# ==============================================================================

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HSTS & SSL Redirect (Active in production, disabled in local development)
if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '1') == '1'
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
else:
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False

# ==============================================================================
# PRODUCTION STRUCTURED LOGGING
# ==============================================================================

LOG_LEVEL = os.environ.get('DJANGO_LOG_LEVEL', 'INFO' if not DEBUG else 'INFO')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': LOG_LEVEL,
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING' if not DEBUG else 'INFO',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
    },
}

# ==============================================================================
# EMAIL CONFIGURATION
# ==============================================================================

EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER or 'noreply@ccsconnect.com')

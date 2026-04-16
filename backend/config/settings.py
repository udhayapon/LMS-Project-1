from pathlib import Path
import mimetypes
import os

# ===================== BASE =====================
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-a-$wkrvrn4*)3=kw8z%nmch$y7+vtm5e-kp=dbno!fk9u-ci%g'

DEBUG = True

ALLOWED_HOSTS = []


# ===================== INSTALLED APPS =====================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Custom apps
    'users',
    'courses',

    # Third-party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
]


# ===================== MIDDLEWARE =====================
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',   
    'django.middleware.security.SecurityMiddleware',
    'config.range_middleware.RangeFileMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


# ===================== URLS =====================
ROOT_URLCONF = 'config.urls'


# ===================== TEMPLATES =====================
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',  # ✅ important for auth
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# ===================== WSGI =====================
WSGI_APPLICATION = 'config.wsgi.application'


# ===================== DATABASE =====================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# ===================== PASSWORD VALIDATION =====================
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ===================== INTERNATIONAL =====================
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = False


# ===================== STATIC =====================
STATIC_URL = 'static/'


# ===================== MEDIA =====================
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_ROOT = BASE_DIR / 'media'


# ===================== DEFAULT PK =====================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ===================== CUSTOM USER =====================
AUTH_USER_MODEL = 'users.User'


# ===================== DRF =====================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ]
}


# ===================== CORS + CSRF (IMPORTANT) =====================
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]

CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False

#===================Media / Storage section========================================
mimetypes.add_type("application/pdf", ".pdf", True)
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

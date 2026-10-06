from django.apps import AppConfig


class CompaniesConfig(AppConfig):
    name = 'companies'

    def ready(self):
        from . import signals  # noqa: F401

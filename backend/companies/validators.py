import re

from django.core.exceptions import ValidationError
from django.core.validators import validate_email


def validate_contact_emails(value):
    try:
        validate_email(value)
    except ValidationError:
        for address in re.split(r"[\s,;]+", value.strip()):
            validate_email(address)

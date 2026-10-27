from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django.dispatch import receiver
from .models import CompanyDashboardImage, CompanyAttachment, Company, CompanyChangeHistory, Contact, ContractProduct, HardwareSpec, InstallationLocation, Integration, Solution, System


AUDITED_MODELS = (Company, Contact, ContractProduct, Solution, Integration, System, InstallationLocation, HardwareSpec)


def snapshot(instance):
    """Return database field values, excluding the primary key, as JSON-compatible data."""
    return {field.name: field.value_from_object(instance) for field in instance._meta.fields if field.name != "id"}


def company_for(instance):
    if isinstance(instance, Company):
        return instance, instance.name
    company = instance.company
    return company, company.name


@receiver(pre_save)
def keep_previous_snapshot(sender, instance, **kwargs):
    if sender not in AUDITED_MODELS or not instance.pk:
        return
    try:
        instance._history_before = snapshot(sender.objects.get(pk=instance.pk))
    except sender.DoesNotExist:
        instance._history_before = None


@receiver(post_save)
def record_save(sender, instance, created, **kwargs):
    if sender not in AUDITED_MODELS:
        return
    company, company_name = company_for(instance)
    after = snapshot(instance)
    before = {} if created else getattr(instance, "_history_before", {}) or {}
    changed = list(after) if created else [key for key, value in after.items() if before.get(key) != value]
    if created or changed:
        CompanyChangeHistory.objects.create(
            company=company, company_name=company_name, table_name=sender._meta.db_table,
            record_id=instance.pk, action=CompanyChangeHistory.Action.CREATE if created else CompanyChangeHistory.Action.UPDATE,
            before_data=before, after_data=after, changed_fields=changed,
        )


@receiver(pre_delete)
def record_delete(sender, instance, **kwargs):
    if sender not in AUDITED_MODELS:
        return
    company, company_name = company_for(instance)
    CompanyChangeHistory.objects.create(
        company=company, company_name=company_name, table_name=sender._meta.db_table,
        record_id=instance.pk, action=CompanyChangeHistory.Action.DELETE,
        before_data=snapshot(instance), after_data={}, changed_fields=[],
    )


@receiver(post_delete, sender=CompanyAttachment)
def delete_attachment_file(sender, instance, **kwargs):
    if instance.file:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name))


@receiver(post_delete, sender=CompanyDashboardImage)
def delete_dashboard_images(sender, instance, **kwargs):
    for field in (instance.file, instance.thumbnail):
        if field:
            transaction.on_commit(lambda storage=field.storage, name=field.name: storage.delete(name))

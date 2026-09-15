from django.contrib import admin

from .models import StaffLeaveRequest


@admin.register(StaffLeaveRequest)
class StaffLeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("teacher", "leave_type", "from_date", "to_date", "days", "status", "hod")
    list_filter = ("status", "leave_type", "department")
    search_fields = ("teacher__username", "reason")
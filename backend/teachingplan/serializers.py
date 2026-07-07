# backend/teaching_plans/serializers.py
from datetime import date
from django.apps import apps
from rest_framework import serializers

from .models import TeachingPlan, PlanUnit, SUBJECT_MODEL


def _initials(name: str) -> str:
    parts = (name or "").split()
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _teacher_name(user) -> str:
    full = (user.get_full_name() or "").strip() if hasattr(user, "get_full_name") else ""
    return full or getattr(user, "username", "Unknown")


def _fmt_date(d):
    # "Jul 16" style; trims the leading zero off the day.
    if not d:
        return ""
    return f"{d.strftime('%b')} {d.day}"


# ---------- units ----------
class PlanUnitSerializer(serializers.ModelSerializer):
    # 'due' is what the frontend reads/writes; it maps to complete_by.
    due = serializers.DateField(source="complete_by", required=False, allow_null=True)

    class Meta:
        model = PlanUnit
        fields = ["id", "topic", "hours", "due", "sequence_no",
                  "is_completed", "actual_completed_date"]


# ---------- create / edit a plan (teacher) ----------
class TeachingPlanWriteSerializer(serializers.ModelSerializer):
    units = PlanUnitSerializer(many=True)
    # Frontend sends the subject's primary key as `subject`.
    subject = serializers.PrimaryKeyRelatedField(
        queryset=apps.get_model(SUBJECT_MODEL).objects.all()
    )

    class Meta:
        model = TeachingPlan
        fields = ["id", "subject", "class_section", "semester", "allotted_hours", "status", "units"]

    def validate_status(self, value):
        # A teacher can only save as draft or submit for review here.
        if value not in ("draft", "submitted"):
            raise serializers.ValidationError("Status must be 'draft' or 'submitted'.")
        return value

    def create(self, validated_data):
        units_data = validated_data.pop("units", [])
        request = self.context.get("request")

        from django.utils import timezone
        teacher = request.user
        department = getattr(teacher, "department", None)
        submitted_at = timezone.now() if validated_data.get("status") == "submitted" else None

        # If a plan already exists for this teacher+subject+class+semester, update it
        # instead of creating a duplicate (which would violate unique_together).
        plan, _created = TeachingPlan.objects.update_or_create(
            teacher=teacher,
            subject=validated_data["subject"],
            class_section=validated_data["class_section"],
            semester=validated_data["semester"],
            defaults={
                "department": department,
                "allotted_hours": validated_data.get("allotted_hours", 0),
                "status": validated_data.get("status", "draft"),
                "submitted_at": submitted_at,
            },
        )

        # Replace the units with the ones just submitted
        plan.units.all().delete()
        for i, u in enumerate(units_data, start=1):
            PlanUnit.objects.create(
                plan=plan,
                topic=u.get("topic", ""),
                hours=u.get("hours", 0),
                complete_by=u.get("complete_by"),
                sequence_no=u.get("sequence_no", i),
            )
        return plan


# ---------- read a plan / department list (HOD) ----------
class TeachingPlanReadSerializer(serializers.ModelSerializer):
    code = serializers.SerializerMethodField()
    subject = serializers.SerializerMethodField()
    teacher = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    cls = serializers.CharField(source="class_section")
    sem = serializers.CharField(source="semester")
    allotted = serializers.IntegerField(source="allotted_hours")
    status = serializers.SerializerMethodField()       # display status for the UI
    done = serializers.IntegerField(source="done_units")
    total = serializers.IntegerField(source="total_units")
    units = PlanUnitSerializer(many=True, read_only=True)

    class Meta:
        model = TeachingPlan
        fields = ["id", "code", "subject", "teacher", "initials", "cls", "sem",
                  "allotted", "status", "done", "total", "hod_comment", "units"]

    def get_code(self, obj):
        return getattr(obj.subject, "code", "") or ""

    def get_subject(self, obj):
        return getattr(obj.subject, "name", str(obj.subject))

    def get_teacher(self, obj):
        return _teacher_name(obj.teacher)

    def get_initials(self, obj):
        return _initials(_teacher_name(obj.teacher))

    def get_status(self, obj):
        # Map the stored status onto the strings the frontend expects.
        if obj.status == "submitted":
            return "pending"
        if obj.status in ("draft", "rejected"):
            return obj.status
        # approved -> derive on-track / behind / just-published
        overdue = obj.units.filter(is_completed=False,
                                   complete_by__lt=date.today()).exists()
        if overdue:
            return "behind"
        if obj.done_units == 0:
            return "approved"     # published, nothing logged yet
        return "ontrack"
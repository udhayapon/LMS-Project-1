# backend/teaching_plans/models.py
from django.db import models
from django.conf import settings

# ============================================================
# CONFIG — point these three strings at YOUR existing models.
# Format is "app_label.ModelName". Check each app's models.py.
# ============================================================
SUBJECT_MODEL = "courses.Subject"     # your Subject lives in the courses app
DEPARTMENT_MODEL = "users.Department"  # your Department lives in the users app (its hod FK already matches)
# (User comes from settings.AUTH_USER_MODEL automatically.)
# ============================================================


class TeachingPlan(models.Model):
    STATUS = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teaching_plans"
    )
    subject = models.ForeignKey(
        SUBJECT_MODEL, on_delete=models.CASCADE, related_name="teaching_plans"
    )
    department = models.ForeignKey(
        DEPARTMENT_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="teaching_plans"
    )
    # If you have a Section/Class model, you can later swap this CharField for an FK.
    class_section = models.CharField(max_length=100)   # e.g. "CSE 3rd year - A"
    semester = models.CharField(max_length=50)         # e.g. "Odd semester 2026"
    allotted_hours = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=20, choices=STATUS, default="draft")
    hod_comment = models.TextField(blank=True, default="")

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="reviewed_plans"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        # One plan per teacher+subject+class+semester (a teacher can't submit two for the same class).
        unique_together = ("teacher", "subject", "class_section", "semester")

    def __str__(self):
        return f"{self.subject} · {self.class_section} ({self.get_status_display()})"

    # ---- progress helpers (used by the HOD department view) ----
    @property
    def total_units(self):
        return self.units.count()

    @property
    def done_units(self):
        return self.units.filter(is_completed=True).count()


class PlanUnit(models.Model):
    plan = models.ForeignKey(TeachingPlan, on_delete=models.CASCADE, related_name="units")
    topic = models.CharField(max_length=200)
    hours = models.PositiveIntegerField(default=0)
    # Planned deadline — auto-filled from the timetable on the frontend, stored here.
    complete_by = models.DateField(null=True, blank=True)
    sequence_no = models.PositiveIntegerField(default=1)

    # Which period of the day this class hour is (1, 2, 3...).
    # A subject can meet more than once on the same date, so complete_by alone does
    # not identify a class — the pair (complete_by, period_no) does. Without this, a
    # topic's period can only be guessed by counting its position in the class-day
    # list, and that count shifts the moment a holiday is added.
    # null=True because rows written before this migration have no period yet.
    period_no = models.PositiveIntegerField(null=True, blank=True)

    # Filled in after the plan is approved, as the teacher logs progress.
    is_completed = models.BooleanField(default=False)
    actual_completed_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["sequence_no"]

    def __str__(self):
        return f"{self.topic} ({self.hours}h)"
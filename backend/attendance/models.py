from django.db import models
from django.conf import settings
from django.utils import timezone


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('duty_leave', 'Duty Leave'),
    ]
    teaching_assignment = models.ForeignKey(
        "courses.TeachingAssignment",
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    student = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    hour = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='absent')
    marked_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendance_marked'
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['teaching_assignment', 'student', 'date', 'hour'],
                name='unique_attendance_per_hour'
            )
        ]

    def __str__(self):
        return f"{self.student} - {self.date} Hour {self.hour} - {self.status}"


class ODRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    class Stage(models.TextChoices):
        AWAITING_TUTOR = "awaiting_tutor", "Awaiting tutor"
        AWAITING_HOD = "awaiting_hod", "Awaiting HOD"
        CLOSED = "closed", "Closed"

    class Category(models.TextChoices):
        PAPER = "paper_presentation", "Paper presentation"
        SEMINAR = "seminar", "Seminar / conference"
        PLACEMENT = "placement", "Placement drive"
        SPORTS = "sports", "Sports"
        NSS_NCC = "nss_ncc", "NSS / NCC"
        OTHER = "other", "Other"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="od_requests",
    )
    from_date = models.DateField()
    to_date = models.DateField()
    category = models.CharField(max_length=32, choices=Category.choices)
    reason = models.TextField()
    proof = models.FileField(upload_to="od_proofs/", null=True, blank=True)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    stage = models.CharField(max_length=16, choices=Stage.choices, default=Stage.AWAITING_TUTOR)

    tutor_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="od_tutor_reviews",
    )
    tutor_remark = models.CharField(max_length=255, blank=True)
    tutor_reviewed_at = models.DateTimeField(null=True, blank=True)

    hod_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="od_hod_reviews",
    )
    hod_remark = models.CharField(max_length=255, blank=True)
    hod_reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student} · {self.category} · {self.from_date}→{self.to_date}"
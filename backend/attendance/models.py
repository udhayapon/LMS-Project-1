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
        AWAITING_TUTOR = "awaiting_tutor", "Awaiting class advisor"
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


# ============================================================================
#  APPEND TO: backend/attendance/models.py
#  APPEND TO: backend/attendance/models.py
#  (ODRequest already lives in this file; StaffLeaveRequest sits beside it.)
# ============================================================================


class StaffLeaveRequest(models.Model):
    """
    Leave applied for by a teacher, approved or rejected by the HOD of that
    teacher's department. Single approval stage — there is no Principal role
    in the system yet, so an HOD cannot apply through this model.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"
        RECORDED = "recorded", "Recorded"   # HOD leave: saved, no approval needed

    class LeaveType(models.TextChoices):
        CASUAL = "casual", "Casual leave"
        MEDICAL = "medical", "Medical leave"
        ON_DUTY = "on_duty", "On duty (conference / FDP / workshop)"
        COMPENSATORY = "compensatory", "Compensatory leave"
        OTHER = "other", "Other"

    class Session(models.TextChoices):
        FULL = "full", "Full day"
        FORENOON = "forenoon", "Forenoon"
        AFTERNOON = "afternoon", "Afternoon"

    # Types that cannot be submitted without a supporting document.
    PROOF_REQUIRED = {LeaveType.MEDICAL, LeaveType.ON_DUTY}

    # Types that may be applied for after the dates have passed
    # (you cannot get a medical certificate before falling ill).
    BACKDATED_ALLOWED = {LeaveType.MEDICAL}

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_leave_requests",
        limit_choices_to={"role": "teacher"},
    )

    # Snapshot of the department at the time of applying. Kept so that history
    # stays correct if the teacher is later moved to another department.
    department = models.ForeignKey(
        "users.Department",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="staff_leave_requests",
    )

    leave_type = models.CharField(max_length=16, choices=LeaveType.choices)
    from_date = models.DateField()
    to_date = models.DateField()
    session = models.CharField(
        max_length=10, choices=Session.choices, default=Session.FULL
    )

    # Working days in the range, half days included. Calculated on save from
    # the college working calendar — never sent by the client.
    days = models.DecimalField(max_digits=4, decimal_places=1, default=0)

    reason = models.TextField()
    proof = models.FileField(upload_to="staff_leave_proofs/", null=True, blank=True)

    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )

    # The HOD this request was routed to, resolved when it was created.
    hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="staff_leave_to_review",
    )
    hod_remark = models.CharField(max_length=255, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="staff_leave_decisions",
    )

    # HOD leave only: the teacher who handles the HOD's work during the leave.
    backup = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="staff_leave_covering",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "from_date"]),
            models.Index(fields=["teacher", "status"]),
        ]

    def __str__(self):
        return (
            f"{self.teacher} · {self.get_leave_type_display()} · "
            f"{self.from_date}→{self.to_date} ({self.status})"
        )

    @property
    def is_pending(self):
        return self.status == self.Status.PENDING

    @property
    def is_open(self):
        """Still blocks an overlapping request."""
        return self.status in (
            self.Status.PENDING, self.Status.APPROVED, self.Status.RECORDED
        )

    @property
    def needs_proof(self):
        return self.leave_type in self.PROOF_REQUIRED
from django.db import models


# =====================================================
#  TIME SLOT  — the fixed daily periods (bell schedule)
#  Defined once for the whole college.
# =====================================================
class TimeSlot(models.Model):

    period_no = models.PositiveSmallIntegerField(
        unique=True,
        help_text="Order of this period in the day (1, 2, 3 ...). "
                  "Use a high number like 99 for breaks if you want them last in ordering."
    )

    start_time = models.TimeField()
    end_time = models.TimeField()

    # e.g. "Break", "Lunch" — leave blank for normal class periods
    label = models.CharField(
        max_length=40,
        blank=True
    )

    # non-teaching slot (break / lunch) — shown as a band, never filled with a subject
    is_break = models.BooleanField(
        default=False
    )

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        tag = self.label or f"Period {self.period_no}"
        return f"{tag} ({self.start_time:%H:%M}-{self.end_time:%H:%M})"


# =====================================================
#  TIMETABLE ENTRY  — one cell of a weekly grid
#  A TeachingAssignment placed on a day + period.
#  The assignment already carries course / year / subject / teacher,
#  and the semester comes through subject.semester.
# =====================================================
class TimetableEntry(models.Model):

    # ================= DAYS =================
    MON, TUE, WED, THU, FRI, SAT = range(6)

    DAY_CHOICES = [
        (MON, "Monday"),
        (TUE, "Tuesday"),
        (WED, "Wednesday"),
        (THU, "Thursday"),
        (FRI, "Friday"),
        (SAT, "Saturday"),
    ]

    # links to the existing courses app (no data duplicated)
    assignment = models.ForeignKey(
        'courses.TeachingAssignment',
        on_delete=models.CASCADE,
        related_name="timetable_entries"
    )

    day_of_week = models.PositiveSmallIntegerField(
        choices=DAY_CHOICES
    )

    time_slot = models.ForeignKey(
        TimeSlot,
        on_delete=models.CASCADE,
        related_name="entries"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['day_of_week', 'time_slot__period_no']

        # A class (year + that subject's semester) can't have the same subject's
        # assignment placed twice in the same day+slot. The richer clash rules
        # (class clash by year+semester, teacher clash) are enforced in the view,
        # because they depend on related fields.
        constraints = [
            models.UniqueConstraint(
                fields=['assignment', 'day_of_week', 'time_slot'],
                name='unique_entry_per_assignment_slot'
            )
        ]

    # ---- convenience accessors (read through the assignment) ----
    @property
    def teacher(self):
        return self.assignment.teacher

    @property
    def year(self):
        return self.assignment.year          # Year object (course + year_number)

    @property
    def semester(self):
        return self.assignment.subject.semester   # integer 1..8

    def __str__(self):
        return (
            f"{self.get_day_of_week_display()} "
            f"P{self.time_slot.period_no} - "
            f"{self.assignment.subject.name}"
        )

#=======================SEMESTER=======================#
class Semester(models.Model):
 
    name = models.CharField(max_length=100)        # e.g. "Even Semester 2026"
    start_date = models.DateField()
    end_date = models.DateField()
 
    # mark the term currently in use; the views read the active one
    is_active = models.BooleanField(default=True)
 
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        ordering = ["-start_date"]
 
    def __str__(self):
        return f"{self.name} ({self.start_date} to {self.end_date})"
 
 
# =====================================================
#  HOLIDAY  — a single date that overrides classes
#  (Sports Day, Independence Day, etc.)
# =====================================================
class Holiday(models.Model):
 
    date = models.DateField(unique=True)
    name = models.CharField(max_length=120)
 
    class Meta:
        ordering = ["date"]
 
    def __str__(self):
        return f"{self.date} - {self.name}"
# backend/teachingplan/views.py
from datetime import date, datetime, timedelta
from django.apps import apps
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TeachingPlan, DEPARTMENT_MODEL
from .serializers import (
    TeachingPlanWriteSerializer,
    TeachingPlanReadSerializer,
)


def hod_departments(user):
    """Departments where this user is the HOD. Adjust 'hod' if your field differs."""
    Department = apps.get_model(DEPARTMENT_MODEL)
    return Department.objects.filter(hod=user)


def notify(user, title, message):
    """Best-effort notification using your courses.Notification model."""
    try:
        Notification = apps.get_model("courses", "Notification")
        Notification.objects.create(
            recipient=user, title=title, message=message,
            notification_type="announcement",
        )
    except Exception:
        pass


def year_label(year):
    """A human class label from a Year row: 'B.E EEE - Year 1' style.
    This project has no Section model; the class is identified by course + year."""
    if not year:
        return ""
    try:
        return f"{year.course.name} - Year {year.year_number}"
    except Exception:
        return str(year)


class TeachingPlanViewSet(viewsets.ModelViewSet):
    """
    Routes (registered under /api/teaching-plans/):
      GET    /teaching-plans/options/          -> subjects/classes/semesters for the teacher
      GET    /teaching-plans/subject_status/   -> teacher's subjects, each with its plan status
      GET    /teaching-plans/my/               -> the teacher's own plans
      POST   /teaching-plans/                  -> create (draft or submitted)
      GET    /teaching-plans/department/       -> all plans in the HOD's department
      GET    /teaching-plans/<id>/             -> one plan (detail)
      POST   /teaching-plans/<id>/approve/     -> approve  { comment? }
      POST   /teaching-plans/<id>/reject/      -> reject   { comment }  (comment required)
    """
    permission_classes = [IsAuthenticated]
    queryset = TeachingPlan.objects.all().prefetch_related("units")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TeachingPlanWriteSerializer
        return TeachingPlanReadSerializer

    # ---------- TEACHER: dropdown options ----------
    @action(detail=False, methods=["get"])
    def options(self, request):
        """
        Returns the subjects this teacher is assigned to, plus the class labels
        and semesters, derived from TeachingAssignment (course + year + subject).
        This project has no Section model; classes come from the assignment's year.
        """
        subjects, classes, semesters = [], [], []
        try:
            TA = apps.get_model("courses", "TeachingAssignment")
            assignments = (TA.objects.filter(teacher=request.user)
                           .select_related("subject", "year", "year__course", "course"))
            seen_subj, seen_cls, seen_sem = set(), set(), set()
            for a in assignments:
                subj = a.subject
                if subj.id not in seen_subj:
                    seen_subj.add(subj.id)
                    label = f"{subj.name} - {subj.code}" if subj.code else subj.name
                    subjects.append({"id": subj.id, "label": label})
                    sem_lbl = f"Semester {subj.semester}"
                    if sem_lbl not in seen_sem:
                        seen_sem.add(sem_lbl); semesters.append(sem_lbl)
                # class label = course + year (no sections in this project)
                cls = year_label(a.year)
                if cls and cls not in seen_cls:
                    seen_cls.add(cls); classes.append(cls)
        except Exception:
            pass  # frontend falls back to its demo options if this is empty

        return Response({
            "subjects": subjects,
            "classes": classes,
            "semesters": semesters,
        })

    # ---------- TEACHER: my subjects + each one's plan status (for the overview panel) ----------
    @action(detail=False, methods=["get"])
    def subject_status(self, request):
        """
        GET /teaching-plans/subject_status/
        Returns the teacher's subjects, each with its current plan status
        (not_started / draft / submitted / approved / rejected), a class label,
        and hour progress. Powers the "My subjects" panel at the top of the page.
        Response: { "subjects": [
            {subject_id, subject, label, class_label, semester_label,
             status, planned_hours, allotted_hours}
        ] }
        """
        out = []
        try:
            TA = apps.get_model("courses", "TeachingAssignment")

            assignments = (TA.objects.filter(teacher=request.user)
                           .select_related("subject", "year", "year__course", "course"))

            # existing plans for this teacher, keyed by subject id.
            # If duplicates exist, keep the MOST RECENT one (latest created overwrites).
            plans = {}
            for p in (TeachingPlan.objects.filter(teacher=request.user)
                      .order_by("created_at").prefetch_related("units")):
                plans[p.subject_id] = p

            seen = set()
            for a in assignments:
                subj = a.subject
                if subj.id in seen:
                    continue
                seen.add(subj.id)

                class_label = year_label(a.year)
                label = f"{subj.name} - {subj.code}" if getattr(subj, "code", "") else subj.name
                semester_label = f"Semester {subj.semester}"

                plan = plans.get(subj.id)
                if plan:
                    status_val = plan.status
                    planned = sum(u.hours for u in plan.units.all())
                    allotted = plan.allotted_hours or 0
                else:
                    status_val = "not_started"
                    planned = 0
                    allotted = 0

                out.append({
                    "subject_id": subj.id,
                    "subject": subj.name,
                    "label": label,
                    "class_label": class_label,
                    "semester_label": semester_label,
                    "status": status_val,
                    "planned_hours": planned,
                    "allotted_hours": allotted,
                })
        except Exception:
            pass  # if anything is missing, return whatever we built (frontend hides the panel if empty)

        return Response({"subjects": out})

    # ---------- TEACHER: auto-fill "complete by" dates from the timetable ----------
    @action(detail=False, methods=["post"])
    def auto_dates(self, request):
        """
        Body: { "subject": <subject_id>, "hours": [6, 8, 10], "start": "2026-07-01"? }
        Walks this subject's weekly timetable slots, skipping holidays, and returns
        the finish date for each topic in order (each topic starts the day after the
        previous one ends).
        Response: { "dates": ["2026-07-10", "2026-07-22", ...] }
        """
        subject_id = request.data.get("subject")
        hours_list = request.data.get("hours", []) or []

        TA = apps.get_model("courses", "TeachingAssignment")
        TimetableEntry = apps.get_model("timetable", "TimetableEntry")
        Semester = apps.get_model("timetable", "Semester")
        Holiday = apps.get_model("timetable", "Holiday")

        # the teacher's assignment for this subject (carries course/year/subject)
        assignment = TA.objects.filter(teacher=request.user, subject_id=subject_id).first()
        if not assignment:
            return Response({"allotted": 0, "dates": [], "detail": "No timetable assignment for this subject."})

        # weekly meeting pattern -> { weekday: teaching_hours_that_day }
        entries = (TimetableEntry.objects
                   .filter(assignment=assignment, time_slot__is_break=False)
                   .select_related("time_slot"))
        day_hours = {}
        for e in entries:
            ts = e.time_slot
            secs = (datetime.combine(date.min, ts.end_time)
                    - datetime.combine(date.min, ts.start_time)).seconds
            dur = round(secs / 3600) or 1     # period length in hours (defaults to 1)
            day_hours[e.day_of_week] = day_hours.get(e.day_of_week, 0) + dur
        if not day_hours:
            return Response({"allotted": 0, "dates": [], "detail": "No timetable periods for this subject yet."})

        periods_per_week = sum(day_hours.values())   # total class hours this subject meets per week

        # the active semester defines the term window (start .. end)
        sem = Semester.objects.filter(is_active=True).order_by("-start_date").first()
        holidays = set(Holiday.objects.values_list("date", flat=True))

        # ----- ALLOTTED HOURS: every class hour available across the whole semester -----
        allotted = 0
        if sem:
            d, guard = sem.start_date, 0
            while d <= sem.end_date and guard < 1000:
                guard += 1
                if d.weekday() in day_hours and d not in holidays:
                    allotted += day_hours[d.weekday()]
                d += timedelta(days=1)

        # ----- per-topic "complete by" dates (chained, holidays skipped) -----
        start_str = request.data.get("start")
        if start_str:
            cursor = parse_date(start_str)
        else:
            cursor = sem.start_date if sem else date.today()

        dates = []
        for h in hours_list:
            needed = float(h or 0)
            if needed <= 0:
                dates.append(None)
                continue
            acc, finish, guard = 0, cursor, 0
            while guard < 800:                     # safety stop (~2 years of days)
                guard += 1
                wd = cursor.weekday()              # Mon=0 .. Sun=6 (matches your day_of_week)
                if wd in day_hours and cursor not in holidays:
                    acc += day_hours[wd]
                    if acc >= needed:
                        finish = cursor
                        break
                cursor += timedelta(days=1)
            dates.append(finish.isoformat())
            cursor = finish + timedelta(days=1)    # next topic starts the day after

        return Response({
            "allotted": allotted,
            "periods_per_week": periods_per_week,
            "dates": dates,
        })

    # ---------- TEACHER: ordered list of class days (for the day-by-day form) ----------
    @action(detail=False, methods=["get"])
    def class_days(self, request):
        """
        GET /teaching-plans/class_days/?subject=<id>
        Returns every class day for this subject across the active semester, in order.
        Each class day carries its date, weekday, hours, period label and time label.
        Holidays that fall on a would-be class day are returned too, marked skipped.
        Response: { "allotted": 46, "days": [
            {date, weekday, hours, period_label, time_label},        # a class day
            {date, weekday, holiday: true, holiday_name},            # a skipped holiday
        ] }
        """
        subject_id = request.query_params.get("subject")

        TA = apps.get_model("courses", "TeachingAssignment")
        TimetableEntry = apps.get_model("timetable", "TimetableEntry")
        Semester = apps.get_model("timetable", "Semester")
        Holiday = apps.get_model("timetable", "Holiday")

        assignment = TA.objects.filter(teacher=request.user, subject_id=subject_id).first()
        if not assignment:
            return Response({"allotted": 0, "days": []})

        entries = (TimetableEntry.objects
                   .filter(assignment=assignment, time_slot__is_break=False)
                   .select_related("time_slot"))

        # group this subject's periods by weekday - keep EACH period separate
        day_slots = {}
        for e in entries:
            day_slots.setdefault(e.day_of_week, []).append(e.time_slot)
        if not day_slots:
            return Response({"allotted": 0, "days": []})

        def fmt_time(t):
            h = t.hour % 12 or 12
            ampm = "am" if t.hour < 12 else "pm"
            return f"{h}:{t.minute:02d} {ampm}" if t.minute else f"{h} {ampm}"

        def dur_hours(slot):
            secs = (datetime.combine(date.min, slot.end_time)
                    - datetime.combine(date.min, slot.start_time)).seconds
            return round(secs / 3600) or 1

        # for each weekday, keep the list of individual periods (sorted)
        day_periods = {}
        for wd, slots in day_slots.items():
            day_periods[wd] = sorted(slots, key=lambda s: s.period_no)

        sem = Semester.objects.filter(is_active=True).order_by("-start_date").first()
        def _hol_label(h):
            return getattr(h, "name", None) or getattr(h, "title", None) or getattr(h, "reason", None) or "Holiday"
        holidays = {h.date: _hol_label(h) for h in Holiday.objects.all()}
        WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        days, allotted = [], 0
        if sem:
            d, guard = sem.start_date, 0
            while d <= sem.end_date and guard < 1000:
                guard += 1
                wd = d.weekday()
                if wd in day_periods:
                    if d in holidays:
                        # one greyed holiday row for the whole day is enough
                        days.append({"date": d.isoformat(), "weekday": WEEKDAYS[wd],
                                     "holiday": True, "holiday_name": holidays[d]})
                    else:
                        # ONE ROW PER PERIOD - teacher can type a different topic in each
                        for slot in day_periods[wd]:
                            h = dur_hours(slot)
                            allotted += h
                            days.append({
                                "date": d.isoformat(),
                                "weekday": WEEKDAYS[wd],
                                "hours": h,
                                "period_label": f"Period {slot.period_no}",
                                "time_label": f"{fmt_time(slot.start_time)}-{fmt_time(slot.end_time)}",
                            })
                d += timedelta(days=1)
        return Response({"allotted": allotted, "days": days})

    # ---------- TEACHER: my assigned weekly timetable (for the View timetable popup) ----------
    @action(detail=False, methods=["get"])
    def my_timetable(self, request):
        """
        GET /teaching-plans/my_timetable/
        Returns this teacher's weekly grid: one row per period (by period number),
        each with a cell per weekday holding the assigned subject name (or null = free).
        Response: { "weekdays": [...], "rows": [ {label, is_break, cells:[...6]} ] }
        """
        TimetableEntry = apps.get_model("timetable", "TimetableEntry")
        TimeSlot = apps.get_model("timetable", "TimeSlot")

        slots = list(TimeSlot.objects.all().order_by("start_time", "period_no"))
        entries = (TimetableEntry.objects
                   .filter(assignment__teacher=request.user)
                   .select_related("assignment", "assignment__subject", "time_slot"))

        cell = {}  # (weekday, slot_id) -> {name, subject_id}
        for e in entries:
            subj = getattr(e.assignment, "subject", None) if e.assignment_id else None
            cell[(e.day_of_week, e.time_slot_id)] = {
                "name": getattr(subj, "name", "") if subj else "",
                "subject_id": getattr(subj, "id", None) if subj else None,
            }

        ORD = {1: "1st", 2: "2nd", 3: "3rd"}
        ordinal = lambda n: ORD.get(n, f"{n}th")

        rows = []
        for s in slots:
            if getattr(s, "is_break", False):
                rows.append({"label": s.label or "Break", "is_break": True, "cells": []})
                continue
            cells = [cell.get((d, s.id)) for d in range(6)]  # Mon..Sat, dict or None
            rows.append({"label": s.label or ordinal(s.period_no), "is_break": False, "cells": cells})

        return Response({"weekdays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "rows": rows})

    # ---------- TEACHER: my plans ----------
    @action(detail=False, methods=["get"])
    def my(self, request):
        qs = self.get_queryset().filter(teacher=request.user)
        return Response(TeachingPlanReadSerializer(qs, many=True).data)

    # ---------- HOD: department plans ----------
    @action(detail=False, methods=["get"])
    def department(self, request):
        depts = hod_departments(request.user)
        if not depts.exists():
            return Response([], status=200)  # not an HOD -> empty
        # Exclude drafts; the HOD only sees submitted/approved/rejected plans.
        qs = (self.get_queryset()
              .filter(department__in=depts)
              .exclude(status="draft"))
        return Response(TeachingPlanReadSerializer(qs, many=True).data)

    # ---------- STUDENT: approved plans published to my class ----------
    @action(detail=False, methods=["get"])
    def student(self, request):
        """
        GET /teaching-plans/student/
        Returns ONLY approved plans for the class this student belongs to.
        Pending/draft/rejected plans are never returned to students.

        This project has no Section model; a student's class is derived from the
        subjects they're enrolled in (Enrollment -> TeachingAssignment -> year).
        """
        my_labels = set()
        try:
            Enrollment = apps.get_model("courses", "Enrollment")
            enrolls = (Enrollment.objects.filter(student=request.user)
                       .select_related("teaching_assignment__year__course"))
            for en in enrolls:
                lbl = year_label(en.teaching_assignment.year)
                if lbl:
                    my_labels.add(lbl)
        except Exception:
            pass

        qs = self.get_queryset().filter(status="approved")
        # if we found the student's class labels, show only those; otherwise
        # (fallback during setup) show all approved plans so the page isn't empty.
        if my_labels:
            qs = qs.filter(class_section__in=my_labels)

        return Response(TeachingPlanReadSerializer(qs, many=True).data)

    # ---------- HOD: approve ----------
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        plan = self.get_object()
        depts = hod_departments(request.user)
        allowed = (plan.department_id and depts.filter(id=plan.department_id).exists()) \
                  or (plan.department_id is None and depts.exists())
        if not allowed:
            return Response({"detail": "Only the department HOD can approve."}, status=403)
        plan.status = "approved"
        plan.hod_comment = (request.data.get("comment") or "").strip()
        plan.reviewed_by = request.user
        plan.reviewed_at = timezone.now()
        plan.save()
        notify(plan.teacher, "Teaching plan approved",
               f"Your plan for {plan.subject} ({plan.class_section}) was approved.")
        return Response(TeachingPlanReadSerializer(plan).data)

    # ---------- HOD: reject ----------
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        plan = self.get_object()
        depts = hod_departments(request.user)
        allowed = (plan.department_id and depts.filter(id=plan.department_id).exists()) \
                  or (plan.department_id is None and depts.exists())
        if not allowed:
            return Response({"detail": "Only the department HOD can reject."}, status=403)
        comment = (request.data.get("comment") or "").strip()
        if not comment:
            return Response({"detail": "A comment is required when rejecting."},
                            status=status.HTTP_400_BAD_REQUEST)
        plan.status = "rejected"
        plan.hod_comment = comment
        plan.reviewed_by = request.user
        plan.reviewed_at = timezone.now()
        plan.save()
        notify(plan.teacher, "Teaching plan sent back",
               f"Your plan for {plan.subject} needs revision: {comment}")
        return Response(TeachingPlanReadSerializer(plan).data)
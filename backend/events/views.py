from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.db import models
from django.contrib.auth import get_user_model

from .models import CalendarEvent,Announcement
from .serializers import CalendarEventSerializer,AnnouncementSerializer

# cross-app imports from courses
from courses.models import Enrollment, Notification
from courses.views import get_parent_children

User = get_user_model()


# ===================== CALENDAR HELPERS =====================
def get_student_year(user):
    en = Enrollment.objects.filter(student=user).first()
    if en:
        return en.teaching_assignment.year.year_number
    return None


def get_parent_child_years(user):
    years = []
    for child in get_parent_children(user):
        y = get_student_year(child)
        if y is not None:
            years.append(y)
    return years


def notify_calendar_audience(event):
    date_text = event.start_date.strftime("%d %b %Y")
    title = f"{event.get_event_type_display()}: {event.title}"
    message = f"{event.title} on {date_text}"

    if event.audience == 'everyone':
        recipients = User.objects.all()
    elif event.audience == 'teachers':
        recipients = User.objects.filter(role='teacher')
    elif event.audience == 'students':
        recipients = User.objects.filter(role='student')
        if event.year_number:
            ids = [s.id for s in recipients if get_student_year(s) == event.year_number]
            recipients = User.objects.filter(id__in=ids)
    elif event.audience == 'parents':
        recipients = User.objects.filter(role='parent')
        if event.year_number:
            ids = [p.id for p in recipients if event.year_number in get_parent_child_years(p)]
            recipients = User.objects.filter(id__in=ids)
    else:
        recipients = User.objects.none()

    for u in recipients:
        Notification.objects.create(
            recipient=u, title=title, message=message,
            notification_type='announcement',
        )


# ===================== CALENDAR EVENT =====================
class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return CalendarEvent.objects.all().order_by('start_date')

        qs = CalendarEvent.objects.filter(audience='everyone')

        if user.role == 'teacher':
            qs = qs | CalendarEvent.objects.filter(audience='teachers')
        elif user.role == 'student':
            se = CalendarEvent.objects.filter(audience='students').filter(
                models.Q(year_number__isnull=True) | models.Q(year_number=get_student_year(user))
            )
            qs = qs | se
        elif user.role == 'parent':
            pe = CalendarEvent.objects.filter(audience='parents').filter(
                models.Q(year_number__isnull=True) | models.Q(year_number__in=get_parent_child_years(user))
            )
            qs = qs | pe

        return qs.distinct().order_by('start_date')

    def perform_create(self, serializer):
        if self.request.user.role != 'admin':
            raise ValidationError("Only admin can add calendar events.")
        event = serializer.save(created_by=self.request.user)
        notify_calendar_audience(event)

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            raise ValidationError("Only admin can edit calendar events.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            raise ValidationError("Only admin can delete calendar events.")
        instance.delete()


# ===================== CALENDAR FEED (events + collapsed exam markers) =====================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calendar_feed(request):
    user = request.user
    month = request.query_params.get("month")
    year = request.query_params.get("year")
    if not (month and year):
        return Response({"detail": "month and year are required."}, status=400)

    items = []

    # ---- admin events, audience-filtered ----
    if user.role == 'admin':
        events = CalendarEvent.objects.all()
    else:
        events = CalendarEvent.objects.filter(audience='everyone')
        if user.role == 'teacher':
            events = events | CalendarEvent.objects.filter(audience='teachers')
        elif user.role == 'student':
            se = CalendarEvent.objects.filter(audience='students').filter(
                models.Q(year_number__isnull=True) | models.Q(year_number=get_student_year(user))
            )
            events = events | se
        elif user.role == 'parent':
            pe = CalendarEvent.objects.filter(audience='parents').filter(
                models.Q(year_number__isnull=True) | models.Q(year_number__in=get_parent_child_years(user))
            )
            events = events | pe
        events = events.distinct()

    events = events.filter(start_date__month=month, start_date__year=year)

    for e in events:
        items.append({
            "id": f"event-{e.id}", "title": e.title, "type": e.event_type,
            "audience": e.audience, "start_date": e.start_date.isoformat(),
            "end_date": e.end_date.isoformat() if e.end_date else None,
            "description": e.description,
        })

    # ---- exam dates: collapse to "Semester Exams Start / End" per semester ----
    from exams.models import ExamSchedule
    from django.db.models import Min, Max

    exam_qs = ExamSchedule.objects.all()
    # students see only their own semester's exams
    if user.role == 'student' and user.semester:
        exam_qs = exam_qs.filter(semester=user.semester)

    # group by semester, find first & last exam date
    spans = (
        exam_qs.values("semester")
        .annotate(first=Min("exam_date"), last=Max("exam_date"))
    )

    for sp in spans:
        sem = sp["semester"]
        first = sp["first"]
        last = sp["last"]

        # show the start marker only if it falls in the requested month
        if first and first.month == int(month) and first.year == int(year):
            items.append({
                "id": f"examstart-{sem}",
                "title": f"Semester {sem} Exams Start",
                "type": "exam",
                "audience": "students",
                "start_date": first.isoformat(),
                "end_date": None,
                "description": f"Semester {sem} examinations begin",
            })

        # show the end marker only if it falls in the requested month
        if last and last.month == int(month) and last.year == int(year):
            items.append({
                "id": f"examend-{sem}",
                "title": f"Semester {sem} Exams End",
                "type": "exam",
                "audience": "students",
                "start_date": last.isoformat(),
                "end_date": None,
                "description": f"Semester {sem} examinations end",
            })

    items.sort(key=lambda x: x["start_date"])
    return Response(items)

# ===================== ANNOUNCEMENT =====================
class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    Admin posts/edits/deletes announcements.
    Each announcement targets an audience; users see and are notified
    only for announcements meant for their group (+ 'everyone').
    """

    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # admin sees all
        if user.role == 'admin':
            return Announcement.objects.all()

        # everyone else: 'everyone' announcements + their own group
        role_aud = {
            'teacher': 'teachers',
            'student': 'students',
            'parent': 'parents',
        }.get(user.role)

        return Announcement.objects.filter(
            models.Q(audience='everyone') | models.Q(audience=role_aud)
        )

    def perform_create(self, serializer):
        if self.request.user.role != 'admin':
            raise ValidationError("Only admin can post announcements.")
        ann = serializer.save(posted_by=self.request.user)

        # notify only the chosen audience
        if ann.audience == 'everyone':
            recipients = User.objects.exclude(id=self.request.user.id)
        elif ann.audience == 'students':
            recipients = User.objects.filter(role='student')
        elif ann.audience == 'teachers':
            recipients = User.objects.filter(role='teacher')
        elif ann.audience == 'parents':
            recipients = User.objects.filter(role='parent')
        else:
            recipients = User.objects.none()

        for u in recipients:
            Notification.objects.create(
                recipient=u,
                title=f"Announcement: {ann.title}",
                message=ann.message[:120],
                notification_type='announcement',
            )

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            raise ValidationError("Only admin can edit announcements.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            raise ValidationError("Only admin can delete announcements.")
        instance.delete()
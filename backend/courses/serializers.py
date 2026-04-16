from rest_framework import serializers
from .models import Course, Enrollment
from users.models import User
from .models import Submission, Assignment


# ===================== COURSE SERIALIZER =====================
class CourseSerializer(serializers.ModelSerializer):
    # Readable fields
    teacher_name = serializers.CharField(source='teacher.username', read_only=True)
    teacher_dept = serializers.CharField(source='teacher.department', read_only=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'title',
            'description',
            'teacher',
            'teacher_name',
            'teacher_dept',
            'created_at'
        ]
    def get_teacher_name(self, obj):
        return obj.teacher.username if obj.teacher else 'N/A'

    def get_teacher_dept(self, obj):
        return obj.teacher.department if obj.teacher else 'N/A'



# ===================== ENROLLMENT SERIALIZER =====================
class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    student_dept = serializers.CharField(source='student.department', read_only=True)

    student_roll = serializers.CharField(source='student.roll_number', read_only=True)

    course_title = serializers.CharField(source='course.title', read_only=True)
    course_teacher = serializers.CharField(source='course.teacher.username', read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id',
            'student',
            'student_name',
            'student_dept',
            'student_roll',   

            'course',
            'course_title',
            'course_teacher',

            'enrolled_at'
        ]
    def get_student_name(self, obj): return obj.student.username
    def get_student_roll(self, obj): return obj.student.roll_number or 'N/A'
    def get_student_dept(self, obj): return obj.student.department
    def get_course_title(self, obj): return obj.course.title
    def get_course_teacher(self, obj): return obj.course.teacher.username if obj.course.teacher else 'N/A'

# ====================teacher=============================

from .models import Note 
from .models import LiveSession
from .models import Notification
from .models import Assignment, Submission, Lecture
from .models import Quiz, Question, QuizAttempt
from .models import Mark


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = '__all__'

class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = '__all__'

class LectureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecture
        fields = '__all__'


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = '__all__'


class LiveSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveSession
        fields = '__all__'

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    class Meta:
        model = Quiz
        fields = '__all__'


class MarkSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = Mark
        fields = '__all__'

class QuizAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizAttempt
        fields = '__all__'
        read_only_fields = ['student', 'score', 'submitted_at']

class SubmissionSerializer(serializers.ModelSerializer):

    # ── read-only convenience fields ──
    student_name      = serializers.CharField(source='student.username',   read_only=True)
    student_roll      = serializers.CharField(source='student.roll_number', read_only=True)
    student_class     = serializers.CharField(source='student.department',  read_only=True) 
    assignment_title  = serializers.CharField(source='assignment.title',   read_only=True)
    course_title      = serializers.CharField(
        source='assignment.course.title', read_only=True
    )
    max_marks         = serializers.IntegerField(
        source='assignment.max_marks', read_only=True
    )
    due_date          = serializers.DateTimeField(
        source='assignment.due_date', read_only=True
    )

    class Meta:
        model  = Submission
        fields = [
            'id',
            'assignment',
            'assignment_title',
            'course_title',
            'student',
            'student_name',
            'student_roll',
            'student_class',
            'file',
            'text_entry',
            'url_entry',
            'submitted_at',
            'status',
            'marks',
            'max_marks',
            'due_date',
            'feedback',
        ]
        
        read_only_fields = [
            'submitted_at',
            'student_name',
            'student_roll',
            'student_class',
            'assignment_title',
            'course_title',
            'max_marks',
            'due_date',
        ]

    def validate(self, data):
        """At least one of file / text_entry / url_entry must be provided."""
        if not (data.get('file') or data.get('text_entry') or data.get('url_entry')):
            raise serializers.ValidationError(
                "Please provide a file, text entry, or URL."
            )
        return data

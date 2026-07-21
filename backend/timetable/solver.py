"""
timetable/solver.py

The AI component — a CP-SAT constraint solver (Google OR-Tools).

You do not tell it HOW to build a timetable. You tell it the RULES, and it
searches the space of possible timetables for one that satisfies them. That
search is the "AI": constraint propagation + branch and bound. It is classical
AI, not machine learning — and it is the right tool, because timetabling is a
textbook constraint satisfaction problem.

It now schedules TWO kinds of thing at once:

  SUBJECTS   — from TeachingAssignment. Have a teacher, a room, a weekly-hours
               target (Subject.weekly_hours). Clash with everything.

  ACTIVITIES — from ClassActivity. Mentor, Library, Sports, Placement Training.
               Usually have NO teacher, so they clash with nobody. They just
               need a cell, and they have opinions about WHERE in the day.

HARD rules (never broken):
  - nothing exceeds its required weekly periods
  - one thing per cell for this class
  - never place into a cell the availability engine rejects
  - a teacher gets at most MAX_PER_DAY periods a day
  - never more than MAX_CONSECUTIVE periods of one subject in a row

SOFT goals (weighted — the solver TRIES, it never fails over them):
  - place as many required periods as possible          (+100 each)
  - spread a subject across the week, not clumped       (-3 per extra)
  - honour each activity's preferred position           (-8 when ignored)
  - keep a "consecutive" activity's periods adjacent    (+6 per adjacency)

A preference that becomes a hard constraint is a bug. If Mentor MUST be first or
last and both are taken, the solver returns INFEASIBLE and you get no timetable
at all. A slightly worse timetable always beats no timetable.
"""

from ortools.sat.python import cp_model

from django.db.models import Q

from courses.models import TeachingAssignment

from .models import ActivityType, ClassActivity, TimeSlot, TimetableEntry
from .services import availability

DAYS = range(6)                  # Mon .. Sat

MAX_PER_DAY = 5                  # periods a teacher may teach in one day
MAX_CONSECUTIVE = 2              # periods of the same subject back to back
MAX_SUBJECT_PER_DAY = 2          # periods of the same subject in one day
SOLVER_SECONDS = 15.0

W_PLACED       = 100             # reward: one more period on the grid
W_CLUMP        = 3               # penalty: same subject stacked in one day
W_BAD_POSITION = 8               # penalty: activity ignores its preferred slot
W_ADJACENT     = 6               # reward: consecutive activity stays together


def class_q(year_id, semester):
    """Every entry belonging to this class, subject or activity."""
    return (
        Q(assignment__year_id=year_id, assignment__subject__semester=semester)
        | Q(class_activity__year_id=year_id, class_activity__semester=semester)
    )


# ---------------------------------------------------------------------------
#  position preferences
# ---------------------------------------------------------------------------
def _lunch_index(slots):
    """Index of the lunch break among ALL slots, so we know what's before/after."""
    every = list(TimeSlot.objects.order_by("period_no"))
    lunch = next((s for s in every if s.is_break and "lunch" in (s.label or "").lower()), None)
    if not lunch:
        return len(slots) // 2          # no lunch defined — split the day in half
    before = [s for s in slots if s.period_no < lunch.period_no]
    return len(before)


def _position_ok(position, index, total, lunch_at):
    """Does slot `index` (0-based, among teachable slots) suit this preference?"""
    P = ActivityType.Position

    if position == P.ANY:
        return True
    if position == P.FIRST:
        return index == 0
    if position == P.LAST:
        return index == total - 1
    if position == P.FIRST_OR_LAST:
        return index == 0 or index == total - 1
    if position == P.BEFORE_LUNCH:
        return index < lunch_at
    if position == P.AFTER_LUNCH:
        return index >= lunch_at
    return True


# ---------------------------------------------------------------------------
#  the solver
# ---------------------------------------------------------------------------
def autofill(year_id, semester, room=None, hod_course_ids=None):
    """
    Fill the empty cells of one class's timetable — subjects AND activities.

    Existing entries stay exactly where they are; the solver works around them.
    Returns (created_count, message).
    """

    # ---------- what we're scheduling ----------
    assignments = list(
        TeachingAssignment.objects
        .select_related("subject", "teacher", "year", "course")
        .filter(year_id=year_id, subject__semester=semester)
    )

    activities = list(
        ClassActivity.objects
        .select_related("activity", "teacher", "year")
        .filter(year_id=year_id, semester=semester)
    )

    if not assignments and not activities:
        return 0, "This class has no subjects or activities configured yet."

    slots = list(TimeSlot.objects.filter(is_break=False).order_by("period_no"))
    if not slots:
        return 0, "No periods have been set up yet."

    n_slots = len(slots)
    lunch_at = _lunch_index(slots)

    # ---------- what's already on the grid ----------
    existing = TimetableEntry.objects.filter(
        class_q(year_id, semester)
    ).select_related("assignment__teacher", "time_slot")

    taken_cells = {(e.day_of_week, e.time_slot_id) for e in existing}

    placed_subject = {}
    placed_activity = {}
    for e in existing:
        if e.assignment_id:
            placed_subject[e.assignment_id] = placed_subject.get(e.assignment_id, 0) + 1
        elif e.class_activity_id:
            placed_activity[e.class_activity_id] = placed_activity.get(e.class_activity_id, 0) + 1

    # ---------- which cells may each thing use? ----------
    # Reuse the SAME availability engine the grid uses, so the solver can never
    # produce a timetable the grid would have greyed out.
    allowed = {}

    for a in assignments:
        av = availability(a, year_id=year_id, semester=semester, room=room)
        allowed[("s", a.id)] = {(c["day"], c["slot"]) for c in av["free"]}

    for ca in activities:
        if ca.teacher:
            # a supervised activity clashes exactly like a lecture — but the
            # availability engine takes an ASSIGNMENT, not an activity. So we
            # rebuild its free set by hand from the teacher's locked entries.
            allowed[("a", ca.id)] = _free_for_teacher(ca.teacher, year_id, semester, slots)
        else:
            # nobody supervises it -> it clashes with nothing. Any free cell.
            allowed[("a", ca.id)] = {
                (d, s.id) for d in DAYS for s in slots
                if (d, s.id) not in taken_cells
            }

    model = cp_model.CpModel()
    x = {}

    def var(kind, oid, d, s_id):
        return x[(kind, oid, d, s_id)]

    # ---------- variables ----------
    for kind, items in (("s", assignments), ("a", activities)):
        for it in items:
            for d in DAYS:
                for s in slots:
                    key = (kind, it.id, d, s.id)
                    x[key] = model.NewBoolVar(f"x_{kind}_{it.id}_{d}_{s.id}")

                    if (d, s.id) not in allowed[(kind, it.id)] or (d, s.id) in taken_cells:
                        model.Add(x[key] == 0)

    # ---------- HARD: one thing per cell ----------
    for d in DAYS:
        for s in slots:
            model.Add(
                sum(var("s", a.id, d, s.id) for a in assignments)
                + sum(var("a", c.id, d, s.id) for c in activities)
                <= 1
            )

    # ---------- HARD: never exceed the required weekly periods ----------
    remaining = {}

    for a in assignments:
        # weekly_hours is a real field on Subject now (default 0). A subject
        # left at 0 simply places nothing — honest, not a crash.
        need = max(0, (a.subject.weekly_hours or 0) - placed_subject.get(a.id, 0))
        remaining[("s", a.id)] = need
        model.Add(sum(var("s", a.id, d, s.id) for d in DAYS for s in slots) <= need)

    for c in activities:
        need = max(0, c.periods_per_week - placed_activity.get(c.id, 0))
        remaining[("a", c.id)] = need
        model.Add(sum(var("a", c.id, d, s.id) for d in DAYS for s in slots) <= need)

    # ---------- HARD: a teacher's daily load ----------
    teachers = {}
    for a in assignments:
        teachers.setdefault(a.teacher_id, {"s": [], "a": []})["s"].append(a)
    for c in activities:
        if c.teacher_id:
            teachers.setdefault(c.teacher_id, {"s": [], "a": []})["a"].append(c)

    for teacher_id, group in teachers.items():
        for d in DAYS:
            # Count what this teacher is ALREADY doing that day — lectures AND
            # supervised activities. Counting only lectures let the solver push
            # them one period over MAX_PER_DAY.
            fixed = existing.filter(
                Q(assignment__teacher_id=teacher_id)
                | Q(class_activity__teacher_id=teacher_id),
                day_of_week=d,
            ).count()
            model.Add(
                sum(var("s", a.id, d, s.id) for a in group["s"] for s in slots)
                + sum(var("a", c.id, d, s.id) for c in group["a"] for s in slots)
                <= max(0, MAX_PER_DAY - fixed)
            )

    # ---------- HARD: no long runs of the same subject ----------
    window = MAX_CONSECUTIVE + 1
    if n_slots >= window:
        for a in assignments:
            for d in DAYS:
                for i in range(n_slots - window + 1):
                    model.Add(
                        sum(var("s", a.id, d, slots[i + k].id) for k in range(window))
                        <= MAX_CONSECUTIVE
                    )

    penalties = []
    rewards = []

    # ---------- SOFT: spread a subject across the week ----------
    for a in assignments:
        for d in DAYS:
            over = model.NewIntVar(0, n_slots, f"over_{a.id}_{d}")
            model.Add(
                over >= sum(var("s", a.id, d, s.id) for s in slots) - MAX_SUBJECT_PER_DAY
            )
            penalties.append(W_CLUMP * over)

    # ---------- SOFT: activity position preference ----------
    # Mentor likes first/last. Library likes after lunch. Sports likes last.
    # Sitting anywhere else costs W_BAD_POSITION — it does NOT forbid it.
    for c in activities:
        pos = c.activity.preferred_position
        if pos == ActivityType.Position.ANY:
            continue
        for d in DAYS:
            for i, s in enumerate(slots):
                if not _position_ok(pos, i, n_slots, lunch_at):
                    penalties.append(W_BAD_POSITION * var("a", c.id, d, s.id))

    # ---------- SOFT: keep a consecutive activity together ----------
    # Placement Training wants P5+P6, not Monday P2 and Thursday P4.
    for c in activities:
        if not c.activity.prefer_consecutive or remaining[("a", c.id)] < 2:
            continue
        for d in DAYS:
            for i in range(n_slots - 1):
                both = model.NewBoolVar(f"adj_{c.id}_{d}_{i}")
                model.AddMultiplicationEquality(
                    both,
                    [var("a", c.id, d, slots[i].id), var("a", c.id, d, slots[i + 1].id)],
                )
                rewards.append(W_ADJACENT * both)

    # ---------- OBJECTIVE ----------
    total_placed = (
        sum(var("s", a.id, d, s.id) for a in assignments for d in DAYS for s in slots)
        + sum(var("a", c.id, d, s.id) for c in activities for d in DAYS for s in slots)
    )

    model.Maximize(W_PLACED * total_placed - sum(penalties) + sum(rewards))

    # ---------- solve ----------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_SECONDS
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return 0, "Could not find a workable schedule with the current rules."

    # ---------- write it ----------
    by_subject = {a.id: a for a in assignments}
    by_activity = {c.id: c for c in activities}

    new_entries = []
    for (kind, oid, d, sid), v in x.items():
        if solver.Value(v) != 1:
            continue
        if kind == "s":
            new_entries.append(TimetableEntry(
                kind=TimetableEntry.Kind.CLASS,
                assignment=by_subject[oid],
                day_of_week=d,
                time_slot_id=sid,
                room=room,
            ))
        else:
            new_entries.append(TimetableEntry(
                kind=TimetableEntry.Kind.ACTIVITY,
                class_activity=by_activity[oid],
                day_of_week=d,
                time_slot_id=sid,
                room=None,          # activities rarely need a room
            ))

    TimetableEntry.objects.bulk_create(new_entries)

    # ---------- report honestly ----------
    total_need = sum(remaining.values())
    created = len(new_entries)
    short = total_need - created

    if short > 0:
        msg = (
            f"Placed {created} periods. {short} could not be placed — "
            f"the teachers or slots they need are taken."
        )
    else:
        msg = f"Placed all {created} remaining periods."

    return created, msg


# ---------------------------------------------------------------------------
#  helpers
# ---------------------------------------------------------------------------
def _free_for_teacher(teacher, year_id, semester, slots):
    """
    Cells a SUPERVISED activity can use: anywhere its teacher isn't already
    locked by another class, and this class isn't already busy.
    """
    from .services import _locked_entries

    # This class's own rows — id, day, slot in one query. We exclude the
    # locked set by primary key, NEVER by class_q: an activity row has
    # assignment = NULL, and `.exclude(assignment__year_id=Y)` drops every
    # OTHER department's activities too (NOT NULL is NULL in SQL, not TRUE).
    own = list(
        TimetableEntry.objects
        .filter(class_q(year_id, semester))
        .values_list("id", "day_of_week", "time_slot_id")
    )
    own_ids = {r[0] for r in own}
    mine = {(r[1], r[2]) for r in own}

    busy = set(
        _locked_entries()
        .filter(
            Q(assignment__teacher=teacher) | Q(class_activity__teacher=teacher)
        )
        .exclude(id__in=own_ids)
        .values_list("day_of_week", "time_slot_id")
    )

    return {
        (d, s.id)
        for d in DAYS
        for s in slots
        if (d, s.id) not in busy and (d, s.id) not in mine
    }
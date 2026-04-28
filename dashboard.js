function renderRecord(log) {
  let label = "";
  let description = "";
  let teacher = "";

  if (log.source === "achievement") {
    label = "Achievement";
    description = log.achievementTitle;
    teacher = "System";
  }

  else if (log.source === "academic") {
    label = "Academic";
    description = `${log.activityTitle} • ${log.score}/${log.maxScore} • ${Math.round(log.percentage)}%`;
    teacher = log.teacherName || "Teacher";
  }

  else if (log.source === "merit") {
    label = "Merit";
    description = log.reason;
    teacher = log.teacherName || "Teacher";
  }

  else if (log.source === "demerit") {
    label = "Demerit";
    description = log.reason;
    teacher = log.teacherName || "Teacher";
  }

  return `
    <div class="record">
      <strong>+${log.pointDifference}</strong> ${label} — ${description}
      <br>
      <small>${teacher}</small>
    </div>
  `;
}

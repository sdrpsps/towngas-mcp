let sequenceCounter = 1;

export function createSequence(code: string | number, date = new Date()) {
  const paddedCode = String(code).padStart(5, "0");
  const timestamp = formatSequenceDate(date);
  const suffix = String(sequenceCounter).padStart(13, "0");
  sequenceCounter += 1;
  return `${paddedCode}${timestamp}${suffix}`;
}

function formatSequenceDate(date: Date) {
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ];
  return `${parts[0]}${parts.slice(1).map((part) => String(part).padStart(2, "0")).join("")}`;
}

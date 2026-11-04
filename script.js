// ===== Все цены собраны здесь, в начале файла =====

// Ступени цен на работу (рублей за квадратный метр) для каждого комплекта.
// "to" — верхняя граница ступени в квадратных метрах.
const KIT_TIERS = {
  basic: [
    { from: 0, to: 40, price: 20000 },
    { from: 40, to: 70, price: 18000 },
    { from: 70, to: 150, price: 16000 },
  ],
  complex: [
    { from: 0, to: 40, price: 28000 },
    { from: 40, to: 70, price: 25000 },
    { from: 70, to: 150, price: 22000 },
  ],
  custom: [
    { from: 0, to: 40, price: 35000 },
    { from: 40, to: 70, price: 32000 },
    { from: 70, to: 150, price: 29000 },
  ],
};

// Для старого кода этапа 1: ступени «Комплексного ремонта».
const COMPLEX_TIERS = KIT_TIERS.complex;

// Материалы: рублей за квадратный метр (если выбраны «с материалами»).
const MATERIALS_PRICE = {
  basic: 12000,
  complex: 20000,
  custom: 25000,
};

// Дополнительные работы: "perM2" — рублей за метр, "fixed" — фиксированная сумма.
const EXTRAS = {
  floor: { perM2: 3500 },     // тёплый пол
  layout: { fixed: 80000 },   // перепланировка
  light: { fixed: 60000 },    // умный свет
};

// Множитель цены для типа помещения.
const TYPE_COEFFICIENT = {
  flat: 1,
  commercial: 1.15,
};

// Минимальная стоимость заказа (рублей).
const MIN_TOTAL = 300000;

// ===== Расчёт =====

// Расчёт «по частям»: каждая цена применяется только к метрам внутри своей ступени.
function calcByParts(area, tiers) {
  let total = 0;
  for (const tier of tiers) {
    const metersInTier = Math.min(area, tier.to) - tier.from;
    if (metersInTier > 0) {
      total += metersInTier * tier.price;
    }
  }
  return Math.round(total);
}

// Полный расчёт. Входные данные:
//   type — "flat" или "commercial"
//   area — площадь числом (м²)
//   kit — "basic", "complex" или "custom"
//   withMaterials — true или false
//   extras — массив ключей из EXTRAS, например ["floor", "light"]
// Возвращает результат по частям: work, materials, extras, coefficient, total.
function calculate({ type, area, kit, withMaterials, extras = [] }) {
  const work = calcByParts(area, KIT_TIERS[kit]);
  const materials = withMaterials ? Math.round(area * MATERIALS_PRICE[kit]) : 0;

  let extrasSum = 0;
  for (const key of extras) {
    const item = EXTRAS[key];
    extrasSum += item.fixed !== undefined ? item.fixed : area * item.perM2;
  }
  extrasSum = Math.round(extrasSum);

  const coefficient = TYPE_COEFFICIENT[type];

  // Сначала умножаем на коэффициент, и только потом применяем минимум.
  const withCoefficient = Math.round((work + materials + extrasSum) * coefficient);
  const total = Math.max(withCoefficient, MIN_TOTAL);

  // minApplied: true, если сумма до применения минимума меньше минимального заказа.
  return { work, materials, extras: extrasSum, coefficient, total, minApplied: withCoefficient < MIN_TOTAL };
}

// ===== Проверка ввода =====

// Допустимый диапазон площади (м²).
const MIN_AREA = 10;
const MAX_AREA = 150;

// Проверяет текст из поля площади. Запятая и точка считаются одинаково.
// Возвращает { ok: true, area: число } или { ok: false, message: текст для показа }.
function parseArea(rawText) {
  const text = String(rawText).trim();

  if (text === "") {
    return { ok: false, message: "Введите площадь помещения в квадратных метрах." };
  }

  // Только цифры и необязательная дробная часть через запятую или точку.
  // Так отсекаются буквы, разметка, минус, экспонента (1e2) и несколько разделителей.
  if (!/^\d+([.,]\d+)?$/.test(text)) {
    return { ok: false, message: "Площадь должна быть числом, например 45 или 45,5." };
  }

  const area = Number(text.replace(",", "."));

  if (area < MIN_AREA) {
    return { ok: false, message: "Площадь меньше " + MIN_AREA + " м². Введите значение от " + MIN_AREA + " до " + MAX_AREA + " м²." };
  }
  if (area > MAX_AREA) {
    return { ok: false, message: "Площадь больше " + MAX_AREA + " м²: нужен индивидуальный расчёт. Свяжитесь с нами." };
  }

  return { ok: true, area: area };
}

// ===== Текст для кнопки «Скопировать расчёт» =====

// Сумма в рублях с пробелами между тысячами, например «2 787 500 ₽».
// Страница и копируемый текст используют одну и ту же функцию, поэтому суммы выглядят одинаково.
function formatRub(value) {
  return value.toLocaleString("ru-RU") + " ₽";
}

// Названия для строк результата (только тексты, цены выше не затрагиваются).
const TYPE_NAMES = {
  flat: "квартира",
  commercial: "коммерческое помещение",
};
// Короткие названия типа только для первой строки «Помещение: ...» в копируемом тексте.
const TYPE_SHORT_NAMES = {
  flat: "квартира",
  commercial: "коммерческое",
};
const KIT_NAMES = {
  basic: "Базовый минимум",
  complex: "Комплексный ремонт",
  custom: "Индивидуальный проект",
};
// Порядок ключей совпадает с порядком флажков на странице.
const EXTRA_NAMES = {
  floor: "тёплый пол",
  layout: "перепланировка",
  light: "умный свет",
};

// Строка коэффициента. Если тип не передан, скобок нет (старый вызов).
function coefficientLine(coefficient, type) {
  const text = "Коэффициент: ×" + coefficient.toFixed(2).replace(".", ",");
  return TYPE_NAMES[type] ? text + " (" + TYPE_NAMES[type] + ")" : text;
}

// Строка доп. работ: названия отмеченных работ в порядке страницы или «0 ₽», если ничего нет.
function extrasLine(sum, extras) {
  const names = Object.keys(EXTRA_NAMES)
    .filter(function (key) { return (extras || []).includes(key); })
    .map(function (key) { return EXTRA_NAMES[key]; });
  const title = names.length > 0 ? "Доп. работы (" + names.join(", ") + ")" : "Доп. работы";
  return title + ": " + formatRub(sum);
}

// Строка про минимальный заказ.
function minOrderLine() {
  return "Применён минимальный заказ: " + formatRub(MIN_TOTAL);
}

// Принимает результат calculate и возвращает готовый текст для буфера обмена.
// Второй параметр (необязательный): { type, area, kit, withMaterials, extras }.
// Если он передан, первой идёт строка «Помещение: ...»; площадь выводится как введена, но с запятой.
// Строки те же, что на странице; последней идёт пометка про замер.
function buildCopyText(result, info) {
  const lines = [];
  if (info) {
    lines.push(
      "Помещение: " + TYPE_SHORT_NAMES[info.type] + ", " +
      String(info.area).trim().replace(".", ",") + " м², " +
      KIT_NAMES[info.kit] + ", " +
      (info.withMaterials ? "с материалами" : "без материалов")
    );
  }
  lines.push(
    "Работа: " + formatRub(result.work),
    "Материалы: " + formatRub(result.materials),
    extrasLine(result.extras, info ? info.extras : []),
    coefficientLine(result.coefficient, info ? info.type : undefined),
    "Итого: " + formatRub(result.total)
  );
  if (result.minApplied) {
    lines.push(minOrderLine());
  }
  lines.push("Точная сумма определяется после замера");
  return lines.join("\r\n");
}

// Позволяет проверять функции из Node.js, не ломая работу в браузере.
if (typeof module !== "undefined") {
  module.exports = {
    formatRub,
    buildCopyText,
    coefficientLine,
    extrasLine,
    minOrderLine,
    KIT_TIERS,
    COMPLEX_TIERS,
    MATERIALS_PRICE,
    EXTRAS,
    TYPE_COEFFICIENT,
    MIN_TOTAL,
    calcByParts,
    calculate,
    parseArea,
  };
}

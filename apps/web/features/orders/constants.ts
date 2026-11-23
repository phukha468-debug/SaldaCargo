import type { PipelineFolderId } from './types';

export const PIPELINE_FOLDERS: Array<{
  id: PipelineFolderId;
  icon: string;
  name: string;
  sub: string;
}> = [
  {
    id: 'waiting_vehicle',
    icon: '📥',
    name: 'Лист ожидания',
    sub: 'Заявка есть, машина не назначена',
  },
  {
    id: 'assigned',
    icon: '📌',
    name: 'Назначенная',
    sub: 'Водитель, маршрут и цена готовы',
  },
  {
    id: 'in_progress',
    icon: '🚛',
    name: 'В пути',
    sub: 'Активные рейсы + Wialon GPS',
  },
  {
    id: 'pending_review',
    icon: '🔍',
    name: 'На ревью',
    sub: 'Синхронно с разделом «Ревью»',
  },
  {
    id: 'docs_collection',
    icon: '📂',
    name: 'Сбор документов',
    sub: 'ВСМПО-АВИСМА · АВИСМА · Геострой',
  },
  {
    id: 'completed',
    icon: '🗄️',
    name: 'Архив',
    sub: 'Закрытые рейсы · фильтр по дате',
  },
];

export interface LocationPreset {
  key: string;
  label: string;
  city: string;
  address: string;
  loadingOrg?: string;
  cargoName?: string;
  preventSaldaFinish?: boolean;
}

export const LOCATION_PRESETS: LocationPreset[] = [
  {
    key: 'shaytanka',
    label: 'Шайтанка',
    city: 'Шайтанка',
    address: 'пос. Шайтанка, Свердловская обл.',
    loadingOrg: 'ООО "Геостройиндустрия" (ЛОП)',
    cargoName: 'Пробы керна',
    preventSaldaFinish: true,
  },
  {
    key: 'maminskoe',
    label: 'Маминское',
    city: 'Маминское',
    address: 'село Маминское, Свердловская обл.',
    preventSaldaFinish: true,
  },
  {
    key: 'vorontsovka',
    label: 'Воронцовка',
    city: 'Воронцовка',
    address: 'пос. Воронцовка, Свердловская обл.',
    preventSaldaFinish: true,
  },
  {
    key: 'ekaterinburg',
    label: 'Екатеринбург',
    city: 'Екатеринбург',
    address: 'г. Екатеринбург',
  },
  {
    key: 'tagil',
    label: 'Н.Тагил',
    city: 'Нижний Тагил',
    address: 'г. Нижний Тагил',
  },
  {
    key: 'perm',
    label: 'Пермь',
    city: 'Пермь',
    address: 'г. Пермь',
  },
  {
    key: 'chelyabinsk',
    label: 'Челябинск',
    city: 'Челябинск',
    address: 'г. Челябинск',
  },
  {
    key: 'salda',
    label: 'В.Салда',
    city: 'Верхняя Салда',
    address: 'г. Верхняя Салда, База',
    preventSaldaFinish: false,
  },
];

export const DISTANCE_MATRIX: Record<string, Record<string, number>> = {
  шайтанка: {
    маминское: 275,
    салда: 15,
    екатеринбург: 190,
    тагил: 55,
    воронцовка: 245,
    пермь: 395,
    челябинск: 400,
  },
  маминское: {
    шайтанка: 275,
    салда: 260,
    екатеринбург: 85,
    тагил: 225,
    воронцовка: 490,
    пермь: 445,
    челябинск: 210,
  },
  салда: {
    шайтанка: 15,
    маминское: 260,
    екатеринбург: 175,
    тагил: 45,
    воронцовка: 230,
    пермь: 380,
    челябинск: 385,
  },
  екатеринбург: {
    салда: 175,
    шайтанка: 190,
    маминское: 85,
    тагил: 140,
    воронцовка: 400,
    пермь: 360,
    челябинск: 210,
  },
  тагил: {
    салда: 45,
    шайтанка: 55,
    маминское: 225,
    екатеринбург: 140,
    воронцовка: 270,
    пермь: 340,
    челябинск: 350,
  },
  воронцовка: {
    салда: 230,
    шайтанка: 245,
    маминское: 490,
    екатеринбург: 400,
    тагил: 270,
    пермь: 420,
    челябинск: 610,
  },
  пермь: {
    салда: 380,
    шайтанка: 395,
    маминское: 445,
    екатеринбург: 360,
    тагил: 340,
    воронцовка: 420,
    челябинск: 560,
  },
  челябинск: {
    салда: 385,
    шайтанка: 400,
    маминское: 210,
    екатеринбург: 210,
    тагил: 350,
    воронцовка: 610,
    пермь: 560,
  },
};

export const MONTH_NAMES_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

import { db } from './src/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

const vehicles = [
  { plate: 'О 866 РТ', model: 'Газель 866', type: 'gazelle', capacity: '3м город', gpsEnabled: false, currentOdometer: 142580, nextServiceKm: 150000 },
  { plate: 'А 099 УТ', model: 'Газель 099', type: 'gazelle', capacity: '3м город', gpsEnabled: false, currentOdometer: 89000, nextServiceKm: 95000 },
  { plate: 'В 443 ТР', model: 'Валдай 443', type: 'valday', capacity: '6м', gpsEnabled: true, currentOdometer: 215000, nextServiceKm: 220000 },
  { plate: 'М 777 СТ', model: 'Митсубиси Кантер', type: 'mitsubishi', capacity: '5т', gpsEnabled: false, currentOdometer: 340000, nextServiceKm: 345000 },
];

export async function seedData() {
  const snapshot = await getDocs(collection(db, 'vehicles'));
  if (snapshot.empty) {
    console.log('Seeding vehicles...');
    for (const v of vehicles) {
      await addDoc(collection(db, 'vehicles'), v);
    }
  }
}

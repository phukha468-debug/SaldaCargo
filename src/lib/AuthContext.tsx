import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          let profileData = userDoc.data() as UserProfile;
          
          // Force owner role for the user phukha468@gmail.com for ease of review
          if (user.email === 'phukha468@gmail.com' && !profileData.roles.includes('owner')) {
            const updatedRoles = [...new Set([...profileData.roles, 'owner' as UserRole, 'admin' as UserRole])];
            profileData = { ...profileData, roles: updatedRoles };
            await updateDoc(doc(db, 'users', user.uid), { roles: updatedRoles });
          }

          setProfile({ ...profileData, id: user.uid });
          if (!activeRole) setActiveRole(profileData.roles.includes('owner') ? 'owner' : profileData.roles[0]);
        } else {
          // New user defaults to driver, but owner for you
          const isSpecialUser = user.email === 'phukha468@gmail.com';
          const newProfile: UserProfile = {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || (isSpecialUser ? 'Владелец' : 'Водитель'),
            roles: isSpecialUser ? ['owner', 'admin', 'driver'] : ['driver'],
            balance: 0,
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setProfile(newProfile);
          setActiveRole(isSpecialUser ? 'owner' : 'driver');
        }
      } else {
        setProfile(null);
        setActiveRole(null);
      }
      setLoading(false);
    });
  }, [activeRole]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, activeRole, setActiveRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

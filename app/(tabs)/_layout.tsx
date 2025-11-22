import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Используем встроенные иконки

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Поиск',
          headerTitle: 'Поставщики',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mysuppliers"
        options={{
          title: 'Мои связи',
          headerTitle: 'Мои Поставщики',
          tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заказы',
          headerTitle: 'История Заказов',
          tabBarIcon: ({ color }) => <Ionicons name="list" size={28} color={color} />,
        }}
      />
      {/* Скрываем старый файл explore, если вы его не удалили */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

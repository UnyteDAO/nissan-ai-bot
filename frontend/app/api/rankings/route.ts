import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import type { UserScore } from '@/types';

export async function GET() {
  try {
    const snapshot = await db
      .collection('userScores')
      .orderBy('totalScore', 'desc')
      .limit(50)
      .get();

    const rankings: UserScore[] = snapshot.docs.map(doc => ({
      ...doc.data() as UserScore,
    }));

    return NextResponse.json(rankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
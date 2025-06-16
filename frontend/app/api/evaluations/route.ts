import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import type { Evaluation } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get all evaluations first
    const snapshot = await db.collection('evaluations')
      .orderBy('createdAt', 'desc')
      .limit(limit * 3) // Get more to filter
      .get();

    let evaluations: Evaluation[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Evaluation, 'id'>,
    }));

    // Filter by userId if provided
    if (userId) {
      evaluations = evaluations.filter(evalDoc => 
        evalDoc.evaluation.participants && 
        evalDoc.evaluation.participants[userId] !== undefined
      ).slice(0, limit);
    } else {
      evaluations = evaluations.slice(0, limit);
    }

    return NextResponse.json(evaluations);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    );
  }
}
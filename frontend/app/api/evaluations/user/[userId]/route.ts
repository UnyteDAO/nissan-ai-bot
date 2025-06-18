import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import type { Evaluation } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '0');
    const { userId } = await params;
    
    // First, try to use the userEvaluations collection for efficient querying
    const userEvalQuery = db.collection('userEvaluations')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');
    
    // Get paginated user evaluations
    const offset = page * limit;
    const userEvalSnapshot = await userEvalQuery
      .limit(limit + 1) // Get one extra to check if there are more
      .offset(offset)
      .get();
    
    // If userEvaluations collection is empty, fall back to the old method
    if (userEvalSnapshot.empty && page === 0) {
      // Fallback to original method for backward compatibility
      return fetchFromEvaluationsCollection(userId, limit, page);
    }
    
    // Extract evaluation IDs from user evaluations
    const evaluationIds = userEvalSnapshot.docs
      .slice(0, limit) // Remove the extra document
      .map(doc => doc.data().evaluationId);
    
    const hasMore = userEvalSnapshot.docs.length > limit;
    
    // Fetch full evaluation data for these IDs
    const evaluations: Evaluation[] = [];
    
    // Batch fetch evaluations
    if (evaluationIds.length > 0) {
      // Firestore 'in' query supports max 10 items, so we need to batch
      for (let i = 0; i < evaluationIds.length; i += 10) {
        const batch = evaluationIds.slice(i, i + 10);
        const evalSnapshot = await db.collection('evaluations')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        evalSnapshot.docs.forEach(doc => {
          evaluations.push({
            id: doc.id,
            ...doc.data() as Omit<Evaluation, 'id'>,
          });
        });
      }
      
      // Sort evaluations to match the order from userEvaluations
      const evalMap = new Map(evaluations.map(e => [e.id, e]));
      const sortedEvaluations = evaluationIds
        .map(id => evalMap.get(id))
        .filter(e => e !== undefined) as Evaluation[];
      
      return NextResponse.json({
        evaluations: sortedEvaluations,
        hasMore,
        page,
        limit
      });
    }
    
    return NextResponse.json({
      evaluations: [],
      hasMore: false,
      page,
      limit
    });
    
  } catch (error) {
    console.error('Error fetching user evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user evaluations' },
      { status: 500 }
    );
  }
}

// Fallback function using the original method
async function fetchFromEvaluationsCollection(userId: string, limit: number, page: number) {
  const query = db.collection('evaluations')
    .orderBy('createdAt', 'desc');
    
  const allEvaluations: Evaluation[] = [];
  let lastDoc = null;
  let hasMoreData = true;
  
  // Keep fetching until we have no more data
  while (hasMoreData) {
    let currentQuery = query.limit(500);
    
    if (lastDoc) {
      currentQuery = currentQuery.startAfter(lastDoc);
    }
    
    const snapshot = await currentQuery.get();
    
    if (snapshot.empty) {
      hasMoreData = false;
      break;
    }
    
    const newEvaluations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Evaluation, 'id'>,
    }));
    
    allEvaluations.push(...newEvaluations);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    if (snapshot.docs.length < 500) {
      hasMoreData = false;
    }
  }
  
  // Filter evaluations where the user participated
  const userEvaluations = allEvaluations.filter(evalDoc => 
    evalDoc.evaluation.participants && 
    evalDoc.evaluation.participants[userId] !== undefined
  );
  
  // Apply pagination to filtered results
  const startIndex = page * limit;
  const paginatedEvaluations = userEvaluations.slice(startIndex, startIndex + limit);
  
  // Check if there are more results
  const hasMore = userEvaluations.length > startIndex + limit;
  
  return NextResponse.json({
    evaluations: paginatedEvaluations,
    hasMore,
    page,
    limit,
    totalUserEvaluations: userEvaluations.length
  });
}
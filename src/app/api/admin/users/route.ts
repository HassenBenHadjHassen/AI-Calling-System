import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';

async function checkAdminSession() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id) {
    return null;
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user || user.role !== 'ADMIN') {
    return null;
  }
  return { session, adminUser: user };
}

// GET: List all users and their assigned businesses/sections
export async function GET() {
  const authCheck = await checkAdminSession();
  if (!authCheck) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedBusiness: true,
        allowedSections: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error('[API Admin Users GET]', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    );
  }
}

// POST: Create a new account with business and sections assignment
export async function POST(req: NextRequest) {
  const authCheck = await checkAdminSession();
  if (!authCheck) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, role = 'USER', assignedBusiness = 'ALL', allowedSections = 'ALL' } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom sont requis' },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({
      where: { email },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Un compte avec cette adresse email existe déjà' },
        { status: 400 }
      );
    }

    // Sign up via Better Auth
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    // Update with assigned roles and business
    const updated = await db.user.update({
      where: { email },
      data: {
        role,
        assignedBusiness,
        allowedSections,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedBusiness: true,
        allowedSections: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user: updated }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API Admin Users POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}

// PATCH: Update an existing user's business and allowed sections
export async function PATCH(req: NextRequest) {
  const authCheck = await checkAdminSession();
  if (!authCheck) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, role, assignedBusiness, allowedSections } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(assignedBusiness !== undefined && { assignedBusiness }),
        ...(allowedSections !== undefined && { allowedSections }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedBusiness: true,
        allowedSections: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: unknown) {
    console.error('[API Admin Users PATCH]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la modification' },
      { status: 500 }
    );
  }
}

// DELETE: Delete an account (except oneself)
export async function DELETE(req: NextRequest) {
  const authCheck = await checkAdminSession();
  if (!authCheck) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    if (id === authCheck.adminUser.id) {
      return NextResponse.json(
        { error: 'Impossible de supprimer votre propre compte administrateur' },
        { status: 400 }
      );
    }

    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[API Admin Users DELETE]', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}

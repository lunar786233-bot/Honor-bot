const { createCanvas, loadImage } = require('@napi-rs/canvas');

/**
 * Draws a rounded rectangle path.
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Safely loads an image from URL or returns null.
 */
async function safeLoadImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return await loadImage(Buffer.from(arrayBuffer));
  } catch (e) {
    return null;
  }
}

/**
 * Generates a graphic Celebration / Leaderboard Card.
 */
async function generateCelebrationCard({
  title = '🌟 COMMUNITY STAR CHAMPIONS',
  subtitle = 'Celebrating our most helpful members!',
  guildName = 'Discord Server',
  guildIconUrl = null,
  topUsers = [] // Array of { username, displayName, stars, avatarUrl, roleName, rank }
}) {
  const width = 950;
  const height = 540;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Dark Modern Background with Gradients
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0F1015');
  bgGrad.addColorStop(0.5, '#161822');
  bgGrad.addColorStop(1, '#0D0E13');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Background glow circles
  const glow1 = ctx.createRadialGradient(200, 100, 10, 200, 100, 350);
  glow1.addColorStop(0, 'rgba(255, 215, 0, 0.12)');
  glow1.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(750, 400, 10, 750, 400, 350);
  glow2.addColorStop(0, 'rgba(88, 101, 242, 0.15)');
  glow2.addColorStop(1, 'rgba(88, 101, 242, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Outer Glowing Border
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  roundRect(ctx, 15, 15, width - 30, height - 30, 20);
  ctx.stroke();

  // 2. Header Section
  let headerX = 40;
  const guildIcon = await safeLoadImage(guildIconUrl);
  if (guildIcon) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(65, 60, 25, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(guildIcon, 40, 35, 50, 50);
    ctx.restore();

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(65, 60, 25, 0, Math.PI * 2);
    ctx.stroke();
    headerX = 105;
  }

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(title, headerX, 52);

  ctx.fillStyle = '#A0A4B8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`${guildName} • ${subtitle}`, headerX, 74);

  // Header separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 100);
  ctx.lineTo(width - 40, 100);
  ctx.stroke();

  // 3. Main Content
  if (topUsers.length === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ No stars recorded yet for this period! ✨', width / 2, height / 2);
    ctx.fillStyle = '#8E9297';
    ctx.font = '16px sans-serif';
    ctx.fillText('Help fellow members and use /thank to appear on this board!', width / 2, height / 2 + 35);
  } else {
    // Left: Spotlight #1 Champion
    const champion = topUsers[0];
    const cardX = 40;
    const cardY = 120;
    const cardW = 380;
    const cardH = 360;

    // Champion Card Box
    ctx.fillStyle = 'rgba(255, 215, 0, 0.06)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.stroke();

    // Crown & Badge
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑 #1 STAR CHAMPION', cardX + cardW / 2, cardY + 38);

    // Champion Avatar (100x100)
    const avatarImg = await safeLoadImage(champion.avatarUrl);
    const avX = cardX + cardW / 2;
    const avY = cardY + 115;
    const avR = 50;

    if (avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avX - avR, avY - avR, avR * 2, avR * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#5865F2';
      ctx.beginPath();
      ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Avatar Gold Ring
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.stroke();

    // Champion Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    const champName = champion.displayName || champion.username;
    ctx.fillText(champName.length > 18 ? champName.slice(0, 16) + '...' : champName, avX, cardY + 205);

    // Role name / Tier
    ctx.fillStyle = '#57F287';
    ctx.font = '14px sans-serif';
    ctx.fillText(champion.roleName || '🌟 Top Community Helper', avX, cardY + 230);

    // Star Count Box
    const badgeW = 200;
    const badgeH = 45;
    const badgeX = cardX + (cardW - badgeW) / 2;
    const badgeY = cardY + 265;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.lineWidth = 1;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`⭐ ${champion.stars} Stars Earned`, avX, badgeY + 30);

    // Right Side: Runners up (#2 to #5)
    const runners = topUsers.slice(1, 5);
    const listX = 450;
    const listY = 120;
    const rowW = 460;
    const rowH = 75;
    const medals = ['🥈', '🥉', '4️⃣', '5️⃣'];

    for (let i = 0; i < runners.length; i++) {
      const u = runners[i];
      const curY = listY + i * (rowH + 15);

      // Row background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      roundRect(ctx, listX, curY, rowW, rowH, 12);
      ctx.fill();

      ctx.strokeStyle = i === 0 ? 'rgba(192, 192, 192, 0.5)' : (i === 1 ? 'rgba(205, 127, 50, 0.5)' : 'rgba(255, 255, 255, 0.08)');
      ctx.lineWidth = 1;
      roundRect(ctx, listX, curY, rowW, rowH, 12);
      ctx.stroke();

      // Medal / Rank
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(medals[i] || `#${i + 2}`, listX + 18, curY + 45);

      // User Avatar (44x44)
      const uAvImg = await safeLoadImage(u.avatarUrl);
      const uAvX = listX + 65;
      const uAvY = curY + 15;
      if (uAvImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(uAvX + 22, uAvY + 22, 22, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(uAvImg, uAvX, uAvY, 44, 44);
        ctx.restore();
      } else {
        ctx.fillStyle = '#5865F2';
        ctx.beginPath();
        ctx.arc(uAvX + 22, uAvY + 22, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // Name & Stars
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      const uName = u.displayName || u.username;
      ctx.fillText(uName.length > 16 ? uName.slice(0, 14) + '...' : uName, listX + 125, curY + 36);

      ctx.fillStyle = '#A0A4B8';
      ctx.font = '13px sans-serif';
      ctx.fillText(u.roleName || 'Helper', listX + 125, curY + 56);

      // Stars tag
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`⭐ ${u.stars}`, listX + rowW - 20, curY + 45);
    }
  }

  // 4. Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⭐ Community Stars Honor System • Help others and use /thank to earn Stars!', width / 2, height - 25);

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateCelebrationCard
};

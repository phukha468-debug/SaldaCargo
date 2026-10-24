package ru.ancargo66.app.ui.theme

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Пружинящая тактильная анимация нажатия (Bouncy Spring Scale),
 * аналогичная лучшим мировым приложениям (Revolut, Apple, Linear).
 */
fun Modifier.bouncyTouch(
    scaleDownTo: Float = 0.96f
): Modifier = composed {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed) scaleDownTo else 1.0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "bouncyTouchScale"
    )

    this.graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}

/**
 * Пружинящий клик с тактильной отдачей (Haptic Feedback) и физической пружиной
 */
fun Modifier.bouncyClick(
    enabled: Boolean = true,
    scaleDownTo: Float = 0.96f,
    onClick: () -> Unit
): Modifier = composed {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val haptic = LocalHapticFeedback.current

    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) scaleDownTo else 1.0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "bouncyClickScale"
    )

    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .clickable(
            interactionSource = interactionSource,
            indication = null,
            enabled = enabled
        ) {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            onClick()
        }
}

/**
 * Интуитивный жест свайпа слева-направо для перехода "Назад"
 */
fun Modifier.swipeToBack(
    edgeWidth: Dp = 90.dp,
    dragThreshold: Dp = 75.dp,
    onBack: () -> Unit
): Modifier = composed {
    val density = LocalDensity.current
    val edgeWidthPx = with(density) { edgeWidth.toPx() }
    val dragThresholdPx = with(density) { dragThreshold.toPx() }

    var isEligibleSwipe by remember { mutableStateOf(false) }
    var totalDragX by remember { mutableFloatStateOf(0f) }

    this.pointerInput(onBack) {
        detectHorizontalDragGestures(
            onDragStart = { offset ->
                isEligibleSwipe = offset.x <= edgeWidthPx
                totalDragX = 0f
            },
            onDragEnd = {
                if (isEligibleSwipe && totalDragX > dragThresholdPx) {
                    onBack()
                }
                isEligibleSwipe = false
                totalDragX = 0f
            },
            onDragCancel = {
                isEligibleSwipe = false
                totalDragX = 0f
            },
            onHorizontalDrag = { change, dragAmount ->
                if (isEligibleSwipe) {
                    totalDragX += dragAmount
                    if (totalDragX > 0f) {
                        change.consume()
                    }
                }
            }
        )
    }
}


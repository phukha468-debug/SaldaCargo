package ru.ancargo66.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.ancargo66.app.ui.theme.SaldaOrangePrimary
import ru.ancargo66.app.ui.theme.Zinc400
import ru.ancargo66.app.ui.theme.bouncyClick

data class BottomNavItem(
    val icon: String,
    val label: String
)

@Composable
fun SaldaBottomNav(
    items: List<BottomNavItem>,
    selectedIndex: Int,
    onSelectIndex: (Int) -> Unit,
    activeColor: Color = SaldaOrangePrimary,
    inactiveColor: Color = Zinc400,
    topIndicatorColor: Color? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(58.dp)
            .background(Color.White)
            .padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        items.forEachIndexed { index, item ->
            val isSelected = index == selectedIndex
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .bouncyClick { onSelectIndex(index) },
                contentAlignment = Alignment.Center
            ) {
                if (isSelected && topIndicatorColor != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .width(36.dp)
                            .height(3.dp)
                            .background(topIndicatorColor, RoundedCornerShape(bottomStart = 2.dp, bottomEnd = 2.dp))
                    )
                }

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = item.icon,
                        fontSize = 18.sp,
                        lineHeight = 19.sp
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = item.label,
                        fontSize = 10.sp,
                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold,
                        color = if (isSelected) activeColor else inactiveColor,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

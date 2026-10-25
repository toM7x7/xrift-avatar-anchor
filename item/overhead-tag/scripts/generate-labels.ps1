# Original label bitmaps. Render Japanese locally; no font file is redistributed.
Add-Type -AssemblyName System.Drawing
$taskAssetDirectory = Join-Path $PSScriptRoot '..\src\assets'
[System.IO.Directory]::CreateDirectory($taskAssetDirectory) | Out-Null
$taskLabels = @{
 work='作業中'; away='離席中'; welcome='話しかけてOK'; equip='装着する'; remove='外す';
 calibrate='再調整'; change='表示切替'; up='上へ ＋'; down='下へ －'; pending='頭を確認中'; title='自動調整タグ'
}
foreach ($taskKey in $taskLabels.Keys) {
 $taskBitmap = [System.Drawing.Bitmap]::new(768,192)
 $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
 $taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $taskGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
 $taskBackground = if ($taskKey -eq 'away') {'#705536'} elseif ($taskKey -eq 'welcome') {'#235f78'} else {'#174e40'}
 $taskGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml($taskBackground))
 $taskPen=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#bde0cc'),5)
 $taskGraphics.DrawRectangle($taskPen,3,3,761,185)
 $taskFontSize=if ($taskLabels[$taskKey].Length -gt 6) {65} else {78}
 $taskFont=[System.Drawing.Font]::new('Meiryo UI',$taskFontSize,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
 $taskFormat=[System.Drawing.StringFormat]::new()
 $taskFormat.Alignment=[System.Drawing.StringAlignment]::Center
 $taskFormat.LineAlignment=[System.Drawing.StringAlignment]::Center
 $taskGraphics.DrawString($taskLabels[$taskKey],$taskFont,[System.Drawing.Brushes]::White,[System.Drawing.RectangleF]::new(12,4,744,180),$taskFormat)
 $taskBitmap.Save((Join-Path $taskAssetDirectory ($taskKey+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
 $taskFormat.Dispose();$taskFont.Dispose();$taskPen.Dispose();$taskGraphics.Dispose();$taskBitmap.Dispose()
}

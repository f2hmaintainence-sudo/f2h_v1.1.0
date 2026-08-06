Add-Type -AssemblyName System.Drawing

$srcPath = "d:\F2H New Project\f2hfresh\apps\mobile\delivery\assets\icon\delivery_logo.png"
$dstPath = "d:\F2H New Project\f2hfresh\apps\mobile\delivery\assets\icon\delivery_logo_padded.png"

$srcImg = [System.Drawing.Image]::FromFile($srcPath)
$w = $srcImg.Width
$h = $srcImg.Height

$scale = 1.45
$nw = [int]($w * $scale)
$nh = [int]($h * $scale)

$bmp = New-Object System.Drawing.Bitmap($nw, $nh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$color = [System.Drawing.ColorTranslator]::FromHtml('#055E38')
$brush = New-Object System.Drawing.SolidBrush($color)
$g.FillRectangle($brush, 0, 0, $nw, $nh)

$x = [int](($nw - $w) / 2)
$y = [int](($nh - $h) / 2)
$g.DrawImage($srcImg, $x, $y, $w, $h)

$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$srcImg.Dispose()

Write-Output "Successfully generated padded image at $dstPath"

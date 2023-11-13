import {
  Button,
  Container,
  Grid,
  Typography
} from '@material-ui/core';
import './HowTo.css';

const imagePath = `${process.env.PUBLIC_URL}/howto/`;

export const HowTo = () => {

  return (
    <>
      <Container>
        <br />
        <Typography variant="h5" gutterBottom>
          <i>How does </i><span id='brand'>Thango</span> <i>work?</i>
        </Typography>

        <div id='instructionContainer'>
          <br />
          <Grid container spacing={7}>
            <Grid item xs={12} sm={6}>
              <Typography variant="h5" gutterBottom>
                Create a Call
              </Typography>
              <ol>
                <li>Enter the name you want to be displayed during the call</li>
                <li>Hit <Button id='createCallBtn' variant='outlined'>Create Call</Button></li>
                <li>Allow Microphone and Camera access via your browser (they can be turn off during the call)</li>
              </ol>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="h5" gutterBottom>
                Join a Call
              </Typography>
              <ol>
                <li>Enter the name you want to be displayed during the call</li>
                <li>Enter the call ID you get from the other party</li>
                <li>Hit <Button id='joinCallBtn' variant='outlined'>Join Call</Button></li>
                <li>Allow Microphone and Camera access via your browser (they can be turn off during the call)</li>
              </ol>
            </Grid>
          </Grid>

          <br />
          <Typography variant="h5" gutterBottom>
            Call Screen Navigation
          </Typography>
          <Grid container spacing={7}>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" gutterBottom>
                Description from left to right as followed:
              </Typography>
              <ol>
                <li>End Call</li>
                <li>Copy Call ID to clipboard to share with other parties</li>
                <li>Share Screen/Tab with audio</li>
                <li>Volume Slider</li>
              </ol>
            </Grid>
            <Grid item xs={12} sm={6}>
              <img src={`${imagePath}call_screen_buttons.png`} alt='call_screen_buttons'/>
            </Grid>
          </Grid>

          <br />
          <Typography variant="h5" gutterBottom>
            Share Tab with Audio instructions
          </Typography>
          <Grid container spacing={7}>
            <Grid item xs={12} sm={6}>
              <ol>
                <li>Make sure you are using Google Chrome or a Chromium-based browser (I'm using Brave)</li>
                <li>Navigate to the last Tab</li>
                <li>Choose the Tab you want to share, and remember to check <b>Share audio</b> in the bottom</li>
                <li>Hit Share and enjoy the experience</li>
              </ol>
            </Grid>
            <Grid item xs={12} sm={6}>
              <img src={`${imagePath}chromium_share.png`} alt='call_screen_buttons'/>
            </Grid>
          </Grid>
        </div>
      </Container>
    </>
  )
}
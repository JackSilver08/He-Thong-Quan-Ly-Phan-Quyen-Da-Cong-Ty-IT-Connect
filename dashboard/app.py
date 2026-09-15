import os
import streamlit as st
import pandas as pd
import plotly.express as px

st.set_page_config(page_title='IT Connect Analytics', page_icon='◈', layout='wide')
st.title('IT Connect · Analytics')
st.caption('Read-only analytics layer. Authorization decisions remain in the Go backend.')

c1,c2,c3,c4=st.columns(4)
c1.metric('Users','—')
c2.metric('Projects','—')
c3.metric('WRITE grants','—')
c4.metric('Resigned users','—')

st.warning('Analytics API/service-token integration is intentionally left as the next hardening step. This dashboard does not expose production data by default.')

df=pd.DataFrame({'Permission':['READ','WRITE','NONE'],'Count':[0,0,0]})
fig=px.bar(df,x='Permission',y='Count',title='Permission distribution')
st.plotly_chart(fig,use_container_width=True)
